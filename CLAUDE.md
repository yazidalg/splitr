# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Splitr — stablecoin bill splitting on Stellar testnet. Three codebases live side by side:

| Path       | What it is                          | Toolchain                          |
| ---------- | ----------------------------------- | ---------------------------------- |
| `src/`     | The CLI — wallets, asset, splits, contract-backed bills | Node 24+ running TypeScript natively |
| `web/`     | Landing page (`/`) + dApp (`/app`)  | Vite 8 + React 19 + Tailwind 4     |
| `soroban/` | On-chain split contract (Rust), deployed to testnet | Cargo workspace + `stellar` CLI    |

`context/Splitr-PRD.md` and the product brief PDF are the source of the copy and the roadmap ("belts"). `README.md` carries the long-form rationale for most decisions below — read it before proposing to change one.

## Commands

```bash
npm install
export SPLITR_PASSPHRASE=dev-testnet-passphrase   # unlocks wallet secrets; prompts if unset

node src/cli.ts help          # every CLI command (or: npm run splitr -- help)
npm run typecheck             # tsc over src/**/*.ts only
npm run web:dev               # http://localhost:5173
npm run web:build             # static output in web/dist
npm run web:typecheck         # tsc over web/ + ../src/money.ts

export PATH="/opt/homebrew/opt/rustup/bin:$PATH"   # cargo is a brew rustup shim, NOT on PATH here
npm run contract:test         # 16 tests
npm run contract:build        # wasm + exported function list
npm run contract:deploy       # needs the `splitr-deployer` stellar identity
cd soroban && cargo test agrees_with_money_ts   # a single test
```

There is **no build step for `src/`** (Node executes the `.ts` files) and **no lint config and no JS/TS test runner**. The two `typecheck` scripts and `cargo test` are the entire automated gate — run all three after touching their respective trees.

## The invariant that spans all three trees

`splitByWeights` in `src/money.ts` is the largest-remainder splitting engine. It is implemented **twice**:

- `src/money.ts` — `BigInt`, used by the CLI *and* imported directly by the landing page's hero calculator (`web/src/lib/split.ts`).
- `soroban/contracts/splitr-split/src/lib.rs` — `i128`, same algorithm including the tie-break-by-index.

`soroban/.../src/test.rs::agrees_with_money_ts` pins the cases both must produce identically. **Changing the algorithm in one place without the other is the single easiest way to break this repo.** Amounts everywhere are integer counts of 1e-7 (Stellar's precision) — never floats, and the shares always sum back to the total exactly.

Two consequences for `src/money.ts` specifically: it must stay dependency-free and browser-safe (the web bundle imports it across the Vite root, which is why `web/vite.config.ts` sets `server.fs.allow: ['..']` and `web/tsconfig.json` includes `../src/money.ts`).

## CLI architecture (`src/`)

`cli.ts` is a hand-rolled `"<group> <sub>"` dispatch table over `commands/{wallet,asset,split}.ts`. Shared layers underneath:

- `config.ts` — env-overridable settings and the `.splitr/asset.json` settlement asset. `SPLITR_ASSET_CODE`/`SPLITR_ASSET_ISSUER` point at an external asset; otherwise `asset init` issues `IDRX` (a local test token — deliberately *not* testnet USDC, which has 200+ unverifiable issuers).
- `store.ts` — JSON files under `.splitr/` (gitignored), plus AES-256-GCM/scrypt encryption of wallet secrets. `keypairFor()` is the only way to get a signer.
- `stellar.ts` — Horizon client, `snapshot()` (balances + reserve floor), `submit()` (build/sign/send), `bidFee()` (p90×2 capped at 0.01 XLM), and `describeSubmitError()` which maps Horizon result codes to actionable hints via the `HINTS` table. Add a hint there rather than handling a result code at a call site.

Three behaviours are load-bearing product promises, not implementation details:

1. **Memo `splitr:<id>` is the join key.** Every settlement payment carries it; it is what lets two concurrent splits between the same people stay separate.
2. **The ledger is the source of truth.** `reconcileSplit()` replays the payer's Horizon payment history and filters by memo + asset + counterparty. There is no local `paid` flag, and adding one would defeat the product's core claim.
3. **`split settle` reconciles first, so it is idempotent.** Running it twice pays nothing the second time; partial payments surface as `OPEN … short N`. Per-member failures are caught and reported as `SKIPPED`, never aborting the loop.

## Landing page (`web/`)

Composition is flat: `App.tsx` stacks section components from `web/src/sections/` inside `LanguageProvider`. Sections use `<Section>` / `<SectionHead>` from `components/Section.tsx` and wrap content in `<Reveal delay={…}>` for the scroll-in cascade.

Four rules the page enforces structurally — breaking any of them is a regression, not a style choice:

- **Copy lives only in `web/src/lib/copy.ts`**, English and Indonesian. The `en` object is the schema and `id` is typed against it, so a missing key fails `web:typecheck`. Never hardcode a visible string in a component. The Indonesian is written for treasurers, not translated.
- **Colour lives only in the token blocks at the top of `web/src/styles.css`** (`:root` / `.dark`, mapped through `@theme inline`). No component holds a hex value. Dark mode is class-based (`@custom-variant dark`), stamped pre-paint by a blocking script in `web/index.html`.
- **Import `web/img/opt/*.webp`, never `web/img/*.png`.** The PNGs are ~6 MB sources; Vite would inline them. Regeneration recipe is in `README.md`.
- **Motion respects `prefers-reduced-motion`** via a global block in `styles.css`. Off-screen carousel slides carry `inert`.
- **Keep Stellar Wallets Kit behind the dynamic import in `web/src/lib/wallet.tsx`.** It is 209 kB — 73% on top of the rest of the page — and most visitors never connect. A static `import` of the kit or any of its modules (or of its `Networks` enum, hence the hard-coded `TESTNET_PASSPHRASE`) silently pulls all of it into the main bundle. Check `npm run web:build`: the entry chunk should stay near 290 kB.

Number formatting is language-dependent (`web/src/lib/split.ts`): Indonesian groups with dots and decimalises with a comma, but the 7-decimal ledger string stays canonical in both languages, because that is what would go on chain.

## The Soroban layer

Deployed to testnet at `CCMCFRZFQLLCUHY44VT2XYCIYNNQWIWFUVGPQXRDPP6XMFVGG4A4GWSD`, recorded in `soroban/deployments.json` (committed on purpose — a fresh clone must reach the same contract). `src/config.ts` reads it, `SPLITR_CONTRACT_ID` overrides it.

`src/soroban.ts` is the client. It uses `contract.Client.from<SplitrSplit>()`, which downloads the spec from the chain, so **there are no generated bindings to regenerate after a redeploy** — the `SplitrSplit` interface supplies TypeScript types only. `signTransaction` accepts both a `Keypair` and Freighter's signature, so the same client serves the CLI and the browser.

Events use `#[contractevent]` structs (`Created`, `Settled`), which places them in the contract's SEP-48 spec; `spec.parseEvent` then decodes them with field names taken from the deployed wasm. Do not go back to the deprecated `env.events().publish` — it emits untyped topics that `parseEvent` cannot match. Note `parsed.name` is the PascalCase struct name (`Settled`), not the lower-case topic symbol.

Two traps that cost real debugging time here:

- **In contract tests, read events immediately after the call that emits them.** `Env::default()` enables invocation metering, which resets the event buffer at every top-level invocation — even a read like `outstanding()` clears it. Assert with `Event::to_xdr(&env, &contract)` against `env.events().all().filter_by_contract(&contract)`.
- **Soroban RPC lags a few seconds behind a just-closed ledger.** Deploys, SAC instantiation and reads right after a write all fail spuriously; retry rather than treating it as an error. `billAfterWrite` in `src/commands/bill.ts` does this for post-settle reads.

`settle` delegates to `settle_part`; `remaining_of` exists so both refuse for the same reasons in the same order. Adding a check to one means adding it to the other, and `both_settle_paths_refuse_for_the_same_reasons` will catch you if you don't.

Redeploying mints a **new contract address** — this contract has no upgrade entry point, so old bills stay on the old instance. Update `soroban/deployments.json` in the same commit as the contract change, or the recorded wasm hash stops matching the source. `stellar contract build` prints the hash; it should equal the one in that file.

Never make two RPC reads that must agree (e.g. `bill()` plus `outstanding()`) — they can simulate against different ledgers and print a member as unpaid next to a total saying otherwise. Derive from one snapshot; `outstandingOf` mirrors the contract's own sum.

## The dApp (`web/src/app/`)

`/app` is routed by `web/src/lib/useRoute.ts` — two lines, no router. Path-based, because the landing page already owns the hash for scroll anchors. Static hosts need the `web/public/_redirects` fallback.

`web/src/lib/contract.ts` mirrors `src/soroban.ts` for the browser; the only real difference is that signing goes to the connected wallet instead of a held keypair. Both read `soroban/deployments.json`, so the contract id has one home.

**The entire `app/` tree must stay behind the `lazy()` in `App.tsx`.** `@stellar/stellar-sdk` is bigger than the whole landing page. A static import of it, or of `app/DApp.tsx`, from anything the landing page renders will pull it into the entry chunk. `npm run web:build` should keep `index-*.js` near 288 kB, with `utils-*` (the SDK) and `client-*` as separate chunks.

## Conventions

- TypeScript is strict everywhere. `src/` uses `nodenext` with `erasableSyntaxOnly` (no enums, no parameter properties) and `verbatimModuleSyntax` — relative imports must carry the `.ts`/`.tsx` extension, in both trees.
- Comments in this codebase explain *why* a decision was made, often citing the alternative that was rejected. Match that register; do not add comments that restate the code.
- Testnet keys in `.splitr/` are disposable, but they are encrypted at rest on purpose — keep it that way.
