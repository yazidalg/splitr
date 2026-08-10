import { Networks, Asset } from '@stellar/stellar-sdk';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export const DATA_DIR = process.env.SPLITR_HOME ?? path.join(process.cwd(), '.splitr');
export const WALLET_FILE = path.join(DATA_DIR, 'wallets.json');
export const SPLIT_FILE = path.join(DATA_DIR, 'splits.json');
export const ASSET_FILE = path.join(DATA_DIR, 'asset.json');

export const HORIZON_URL = process.env.SPLITR_HORIZON ?? 'https://horizon-testnet.stellar.org';
export const NETWORK_PASSPHRASE = process.env.SPLITR_NETWORK_PASSPHRASE ?? Networks.TESTNET;

/**
 * Soroban RPC is a different service from Horizon: Horizon indexes classic
 * operations, RPC serves contract state, simulation and contract events. The
 * CLI needs both — classic payments go through one, bills through the other.
 */
export const RPC_URL = process.env.SPLITR_RPC ?? 'https://soroban-testnet.stellar.org';

/** Which block of `soroban/deployments.json` applies to the configured network. */
export function networkKey(): string {
  if (NETWORK_PASSPHRASE === Networks.PUBLIC) return 'mainnet';
  if (NETWORK_PASSPHRASE === Networks.TESTNET) return 'testnet';
  if (NETWORK_PASSPHRASE === Networks.FUTURENET) return 'futurenet';
  return 'local';
}

/** Base reserve in stroops-equivalent decimal XLM. Network parameter — verify with `splitr net`. */
export const BASE_RESERVE_XLM = 0.5;

export interface AssetConfig {
  code: string;
  /** Wallet label of the issuer, when Splitr issued this asset itself. */
  issuerLabel?: string;
  issuer: string;
}

export function loadAssetConfig(): AssetConfig | null {
  const envCode = process.env.SPLITR_ASSET_CODE;
  const envIssuer = process.env.SPLITR_ASSET_ISSUER;
  if (envCode && envIssuer) return { code: envCode, issuer: envIssuer };
  if (!fs.existsSync(ASSET_FILE)) return null;
  return JSON.parse(fs.readFileSync(ASSET_FILE, 'utf8')) as AssetConfig;
}

export function saveAssetConfig(cfg: AssetConfig): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ASSET_FILE, JSON.stringify(cfg, null, 2));
}

export function requireAssetConfig(): AssetConfig {
  const cfg = loadAssetConfig();
  if (!cfg) {
    throw new Error(
      'No settlement asset configured. Run `npm run splitr -- asset init` first,\n' +
        'or set SPLITR_ASSET_CODE and SPLITR_ASSET_ISSUER in the environment.',
    );
  }
  return cfg;
}

export function assetFrom(cfg: AssetConfig): Asset {
  if (cfg.code === 'XLM' || cfg.code === 'native') return Asset.native();
  return new Asset(cfg.code, cfg.issuer);
}

// ------------------------------------------------------------------ contract

const DEPLOYMENTS_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'soroban',
  'deployments.json',
);

interface Deployment {
  contractId: string;
}

/**
 * Deployed contract ids are read from `soroban/deployments.json` rather than
 * from `.splitr/`, because they are a property of the project, not of one
 * developer's machine: a fresh clone must be able to reach the same contract.
 */
function deployment(name: string): string | null {
  const fromEnv = name === 'splitr-split' ? process.env.SPLITR_CONTRACT_ID : undefined;
  if (fromEnv) return fromEnv;
  if (!fs.existsSync(DEPLOYMENTS_FILE)) return null;
  const all = JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, 'utf8')) as Record<
    string,
    Record<string, Deployment>
  >;
  return all[networkKey()]?.[name]?.contractId ?? null;
}

export function requireContractId(): string {
  const id = deployment('splitr-split');
  if (!id) {
    throw new Error(
      `No splitr-split contract deployed for ${networkKey()}.\n` +
        'Deploy one with `npm run contract:deploy`, or set SPLITR_CONTRACT_ID.',
    );
  }
  return id;
}

/**
 * The settlement asset's Stellar Asset Contract address. This is derived, not
 * looked up: every classic asset's SAC lives at a deterministic address, so it
 * stays correct even when SPLITR_ASSET_CODE points somewhere else. The address
 * still has to be instantiated on-chain once (`stellar contract asset deploy`)
 * before anything can call it; the entry in `deployments.json` records that we
 * did that for IDRX.
 */
export function requireSacId(): string {
  return assetFrom(requireAssetConfig()).contractId(NETWORK_PASSPHRASE);
}
