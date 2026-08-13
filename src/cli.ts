#!/usr/bin/env node
import { HORIZON_URL, NETWORK_PASSPHRASE } from './config.ts';
import { server } from './stellar.ts';
import {
  walletCreate,
  walletList,
  walletFund,
  walletBalance,
  walletTrust,
  walletOnboard,
  walletUnsponsor,
} from './commands/wallet.ts';
import { assetInit, assetIssue, assetShow } from './commands/asset.ts';
import { splitCreate, splitList, splitSettle, splitReconcile } from './commands/split.ts';
import { billCreate, billList, billMine, billShow, billSettle, billWatch } from './commands/bill.ts';
import { describeContractError } from './soroban.ts';

const HELP = `
splitr — stablecoin bill splitting on Stellar (White Belt slice)

  wallet create <label>            generate a keypair, encrypted at rest
  wallet fund <label>              create the account on-chain via Friendbot
  wallet list                      all wallets with their on-chain state
  wallet balance [<label>|--all]   balances, reserve floor, spendable XLM
  wallet trust <label>             open a trustline to the settlement asset
  wallet onboard <label> [--sponsor <label>]
                                   create the account AND its trustline with
                                   sponsored reserves — the member holds 0 XLM
  wallet unsponsor <label> [--sponsor <label>]
                                   hand those reserves back; needs the member to
                                   hold enough XLM to carry them

  asset init [--code IDRX]         stand up the settlement asset + issuer
  asset issue --to <label|G…address> --amount <n>
  asset show

  split create --group <name> --payer <label> --amount <n> --members a,b,c
               [--shares a=2,b=1] [--note "..."]
  split list
  split settle <id> [--member <label>] [--fee-source <label>]
  split reconcile <id>             rebuild who-paid-what from the ledger

  bill create --group <name> --payer <label> --amount <n> --members a,b,c
              [--shares a=2,b=1]   same bill, recorded by the Soroban contract
  bill list                        every bill the contract holds
  bill mine <label>                just the bills this member is on
  bill show <id>                   shares and who has paid, read from the contract
  bill settle <id> --member <l> [--amount <n>]
                                   transfer and record in one invocation;
                                   --amount pays part of a share
  bill watch [--from <ledger>] [--once]
                                   follow contract events as ledgers close

  net                              network, Horizon, live fee stats

Split or bill? \`split\` settles with classic payments and rebuilds the truth from
Horizon; \`bill\` lets the contract compute the shares and keeps the record and the
transfer in one atomic move. Same asset, same balances.

Environment:
  SPLITR_PASSPHRASE   unlocks wallet secrets (prompts if unset)
  SPLITR_HORIZON      default https://horizon-testnet.stellar.org
  SPLITR_RPC          default https://soroban-testnet.stellar.org
  SPLITR_CONTRACT_ID  override the deployed splitr-split contract
  SPLITR_ASSET_CODE / SPLITR_ASSET_ISSUER   point at an external asset
`;

interface Parsed {
  positionals: string[];
  flags: Record<string, string>;
}

function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const body = a.slice(2);
      if (body.includes('=')) {
        const [k, ...v] = body.split('=');
        flags[k] = v.join('=');
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        flags[body] = argv[++i];
      } else {
        flags[body] = 'true';
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

async function netInfo(): Promise<void> {
  const fees = await server.feeStats();
  console.log(`horizon     ${HORIZON_URL}`);
  console.log(`passphrase  ${NETWORK_PASSPHRASE}`);
  console.log(`ledger      ${fees.last_ledger}`);
  console.log(`base fee    ${fees.last_ledger_base_fee} stroops per operation`);
  console.log(`fee charged p50=${fees.fee_charged.p50} p99=${fees.fee_charged.p99}`);
}

async function main(): Promise<void> {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const [group, sub, ...rest] = positionals;
  const cmd = [group, sub].filter(Boolean).join(' ');

  if (!group || flags.help || group === 'help') return void console.log(HELP.trim());

  switch (cmd) {
    case 'wallet create':
      return walletCreate(rest[0]);
    case 'wallet fund':
      return walletFund(rest[0]);
    case 'wallet list':
      return walletList();
    case 'wallet balance':
      return walletBalance(rest[0] ?? (flags.all ? '--all' : ''));
    case 'wallet trust':
      return walletTrust(rest[0]);
    case 'wallet onboard':
      return walletOnboard(rest[0], flags);
    case 'wallet unsponsor':
      return walletUnsponsor(rest[0], flags);

    case 'asset init':
      return assetInit(flags);
    case 'asset issue':
      return assetIssue(flags);
    case 'asset show':
      return assetShow();

    case 'split create':
      return splitCreate(flags);
    case 'split list':
      return splitList();
    case 'split settle':
      return splitSettle(rest[0], flags);
    case 'split reconcile':
      return splitReconcile(rest[0]);

    case 'bill create':
      return billCreate(flags);
    case 'bill list':
      return billList();
    case 'bill mine':
      return billMine(rest[0]);
    case 'bill show':
      return billShow(rest[0]);
    case 'bill settle':
      return billSettle(rest[0], flags);
    case 'bill watch':
      return billWatch(flags);

    case 'net':
    case 'net info':
      return netInfo();

    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP.trim());
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  // A contract rejection carries its reason inside a page of diagnostic XDR;
  // everything else passes through untouched.
  console.error(`\n${describeContractError(err)}`);
  process.exitCode = 1;
});
