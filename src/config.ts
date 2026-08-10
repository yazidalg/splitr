import { Networks, Asset } from '@stellar/stellar-sdk';
import path from 'node:path';
import fs from 'node:fs';

export const DATA_DIR = process.env.SPLITR_HOME ?? path.join(process.cwd(), '.splitr');
export const WALLET_FILE = path.join(DATA_DIR, 'wallets.json');
export const SPLIT_FILE = path.join(DATA_DIR, 'splits.json');
export const ASSET_FILE = path.join(DATA_DIR, 'asset.json');

export const HORIZON_URL = process.env.SPLITR_HORIZON ?? 'https://horizon-testnet.stellar.org';
export const NETWORK_PASSPHRASE = process.env.SPLITR_NETWORK_PASSPHRASE ?? Networks.TESTNET;

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
