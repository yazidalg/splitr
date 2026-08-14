Screenshots referenced by the root `README.md`. PNG, taken at a desktop width so
the nav and the account panel are both legible — except `06`, which is the point
of being narrow.

The names are what `README.md` links to:

| File | What it shows |
| ------------------------- | ------------------------------------------------------------- |
| `01-wallet-connected.png` | `/app` with a wallet connected, address in the nav and the account panel |
| `02-balance.png` | The wallet's own view of the same IDRX and XLM balances |
| `03-new-bill.png` | The New bill form — name, total, members |
| `04-transaction.png` | Bills read back off the contract, with a share paid in full |
| `06-mobile.png` | The landing page at a 375px phone width |
| `07-test.png` | A terminal running `npm test`, through to `pass 17` |
| `08-landing.png` | The landing page hero and its live split calculator |

There is no `05`. The slot was held for the receipt panel — the amount, the
transaction hash and its explorer link shown after a settlement — and the root
README makes that point against the two hashes in **Contract Interactions on
Testnet** instead. If you do capture it, name it `05-transaction-result.png` and
it belongs directly after `04`.

Take the app ones against testnet with a real browser wallet. The point of these
is that every figure is live state read back from the chain — a mock-up would
defeat the one claim the project makes.
