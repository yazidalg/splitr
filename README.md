# Splitr

Stablecoin bill splitting on Stellar. This repo is the **White Belt Level 1** slice of the
[product brief](context/Splitr%20Product%20Idea%20Brief.pdf): build wallets, handle balances,
submit real on-chain transactions.

It is not a throwaway demo — it is the settlement substrate every later belt sits on. The
brief's core promise ("ending disputes over who has paid") is implemented literally:
`split reconcile` rebuilds who-paid-what **from the ledger**, never from a local flag.

## Requirements

Node 24+ (runs TypeScript natively — no build step). Then:

```bash
npm install
export SPLITR_PASSPHRASE=dev-testnet-passphrase   # unlocks wallet secrets; prompts if unset
```

## The full loop

```bash
node src/cli.ts asset init                        # settlement asset + issuer account
node src/cli.ts wallet create alice               # ...repeat for bob, citra
node src/cli.ts wallet fund alice                 # Friendbot creates the account on-chain
node src/cli.ts wallet trust alice                # trustline to IDRX (costs 0.5 XLM reserve)
node src/cli.ts asset issue --to bob --amount 500000

node src/cli.ts split create --group "Dinner Sudirman" \
  --payer alice --amount 300000 --members alice,bob,citra
node src/cli.ts split settle <id>
node src/cli.ts split reconcile <id>
```

`node src/cli.ts help` lists every command.

Verified end-to-end on testnet: a 300,000 IDRX dinner split three ways, settled by two real
payments, reconciled from ledger history. Balances cross-check exactly against every transfer.

## Landing page

`web/` is the marketing site — a Vite + React + Tailwind single page, built from the PRD in
`context/Splitr-PRD.md`.

```bash
npm run web:dev         # http://localhost:5173
npm run web:build       # static output in web/dist
npm run web:typecheck
```

The hero calculator is not a mock-up: it imports `splitByWeights` from `src/money.ts`, the same
largest-remainder function `split create` uses to build on-chain shares. Split 100,000 three ways
on the page and you get `33333.3333334 / 33333.3333333 / 33333.3333333` — identical to the CLI,
because it is the CLI's code.

The root `tsconfig.json` still covers only `src/**/*.ts`; the web app has its own under `web/`, so
`npm run typecheck` checks exactly what it always did.

### Theming

Colour lives entirely in the token blocks at the top of `web/src/styles.css` — a shadcn-style
`:root` / `.dark` pair mapped into Tailwind through `@theme inline`. No component holds a hex
value. Light and dark both ship; the toggle sits in the nav, remembers the choice in
`localStorage['splitr-theme']`, and falls back to `prefers-color-scheme` for first-time visitors.
A blocking script in `web/index.html` stamps the class before first paint so there is no flash.

### Languages

Every visible string lives in `web/src/lib/copy.ts`, in English and Indonesian. The English object
is the schema and the Indonesian one is typed against it, so a missing key fails the build instead
of leaving a blank on the page. The toggle sits in the nav, remembers the choice in
`localStorage['splitr-lang']`, and falls back to `navigator.language`, so an Indonesian visitor
lands on Indonesian without touching anything. Switching also updates `<html lang>`, the document
title, and the meta description.

The Indonesian is written rather than translated: a treasurer says "nalangin", not "menalangi
terlebih dahulu". Terms this audience already uses in English (on-chain, stablecoin, testnet,
wallet, memo, ledger) are left alone.

Two things follow from the language and are handled in `web/src/lib/split.ts`: thousands group with
dots and decimals with a comma in Indonesian, and the hero headline gets a lower size ceiling
because the same sentence runs longer and the headline has a hard two-line budget. The 7-decimal
ledger value stays canonical in both languages, because that is the string that goes on chain.

### The how-it-works carousel

`web/src/sections/HowItWorks.tsx` puts the three steps on a real horizontal track rather than
crossfading them in place. A track gets the direction right for free: advancing pushes the outgoing
slide left and pulls the incoming one in from the right, going back reverses it, and there is no
direction state to get wrong. It also holds the height of its tallest slide, so nothing jumps.

Two motions, both doing a job. The 650ms slide says which way you moved. The two comparison cards
then rise with a 260ms and 360ms delay, so the claim lands after the picture has settled rather
than competing with it. Off-screen slides carry `inert`, so nothing hidden is reachable by keyboard.
The global `prefers-reduced-motion` block in `styles.css` collapses all of it to an instant cut.

### Imagery

Four illustrations, drawn in the brand palette and set in Indonesia: an arisan in the bento, and
one per step of the how-it-works carousel.

The originals live in `web/img/` at roughly 2750x1536 and 6 MB each. **Those are sources, not
assets.** What ships is `web/img/opt/*.webp`: resized to 1400px wide and encoded at q82, which
takes all four from 24 MB to 416 KB with no visible loss at the size they render. Regenerate after
replacing an original:

```bash
cd web/img
sips --resampleWidth 1400 name.png --out /tmp/name.png
cwebp -q 82 -m 6 /tmp/name.png -o opt/name.webp     # brew install webp
```

Import the `opt/` file, never the PNG. Vite inlines whatever it is given, so importing a source
would put 6 MB into the bundle.

Stock photography was tried first and rejected: a seeded placeholder service returned a pine forest
for the "friends splitting a bill" tile, which reads worse than an honest gap.

Two deliberate deviations from the supplied token set, both marked in the file: `--muted-foreground`
is darkened in light mode (the supplied value measured 3.94:1 on `--background`, under AA for body
copy), and `--faint` is added as a third text tier for 10–13px metadata. Measured ratios are
4.58–5.44:1 in light and 5.68–9.66:1 in dark.

## How the White Belt primitives map to the product

| Stellar primitive  | Splitr's version                                    |
| ------------------ | --------------------------------------------------- |
| `Keypair.random()` | onboarding a group member                           |
| Friendbot funding  | testnet stand-in for an IDR on-ramp                 |
| Account balances   | "can this member settle their share?"               |
| `changeTrust`      | accepting the group's settlement currency           |
| `payment` + memo   | **settling one share of a split**                   |
| Payment history    | proof-of-payment replacing "already transferred 🙏" |

## Design decisions worth knowing

**Own test asset, not testnet USDC.** Testnet carries 200+ unrelated `USDC` issuers, none with
a verifiable home domain. Splitr issues `IDRX`, an IDR-pegged test token — reproducible, and
closer to the brief's Rupiah story. Point at any real asset with `SPLITR_ASSET_CODE` /
`SPLITR_ASSET_ISSUER`.

**Integer money.** All arithmetic runs in units of 1e-7 (Stellar's precision) via `BigInt`, with
a largest-remainder split. Shares always sum back to the total exactly — a 100,000 bill across
3 people yields `33333.3333334 / 33333.3333333 / 33333.3333333`, never a lost stroop.

**Memo as the join key.** Every settlement carries `splitr:<id>` as a `MemoText`. That is what
lets reconciliation attribute a payment to a specific bill, and it's why two concurrent splits
between the same people don't contaminate each other.

**Ledger is the source of truth.** `split settle` reconciles before paying, so it is idempotent:
run it twice and the second run pays nothing. Partial payments show as `OPEN … short N`.

**Dynamic fees.** Testnet surge-prices well above the 100-stroop base fee. Splitr bids
`p90 × 2`, capped at 0.01 XLM. Stellar charges the market-clearing rate, not your bid.

**Secrets encrypted at rest.** AES-256-GCM under a scrypt-stretched passphrase in `.splitr/`
(gitignored). Testnet keys are disposable; the habit is not.

## Carried forward to the next belts

- **Reserves are the onboarding wall.** Each member needs ~1.5 XLM before touching a Rupiah.
  Real users won't buy XLM first — Green Belt should sponsor accounts
  (`beginSponsoringFutureReserves`) and pay fees via fee-bump so members arrive holding zero XLM.
- **Custody is unspecified in the brief.** Splitr currently holds keys. Non-custodial
  (Freighter / passkey smart wallets) changes the Indonesian regulatory exposure — decide before
  Blue Belt's 50 users.
- **Black Belt's 20+ mainnet users are gated on a real IDR anchor**, which the brief defers to
  "future." That is the project's largest unstated risk.
