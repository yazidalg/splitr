Screenshots referenced by the root `README.md`. PNG, taken at a desktop width so
the nav and the account panel are both legible — except `06`, which is the point
of being narrow.

The names are what `README.md` links to:

| File | What it shows |
| ---------------------------- | ------------------------------------------------------------- |
| `01-wallet-connected.png` | `/app` with a wallet connected, address in the nav and the account panel |
| `02-balance.png` | The wallet's own view of the same IDRX and XLM balances |
| `03-new-bill.png` | The New bill form — name, total, members |
| `04-transaction.png` | Bills read back off the contract, with a share paid in full |
| `05-transaction-result.png` | **Missing.** The receipt panel: amount, transaction hash, explorer link |
| `06-mobile.png` | **Missing.** `/app` at 375px, wallet connected, a bill on screen |
| `07-tests.png` | **Missing.** A terminal running `npm test` |
| `08-landing.png` | The landing page hero and its live split calculator |

Three still to take:

- **`05`** — settle a share from `/app` and capture the receipt that appears.
- **`06`** — devtools at 375px, or a real phone. Check that the share rows wrap
  rather than scroll sideways; they are built to.
- **`07`** — `npm test`, whole output in frame, the `pass 17` line included.

Take the app ones against testnet with a real browser wallet. The point of these
is that every figure is live state read back from the chain — a mock-up would
defeat the one claim the project makes.
