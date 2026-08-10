import crypto from 'node:crypto';
import fs from 'node:fs';
import readline from 'node:readline';
import { Keypair } from '@stellar/stellar-sdk';
import { DATA_DIR, WALLET_FILE, SPLIT_FILE } from './config.ts';

export interface EncryptedSecret {
  salt: string;
  iv: string;
  tag: string;
  data: string;
}

export interface Wallet {
  label: string;
  publicKey: string;
  secret: EncryptedSecret;
  createdAt: string;
}

export interface SplitMember {
  label: string;
  publicKey: string;
  weight: string;
  owes: string;
}

export interface Split {
  id: string;
  group: string;
  note: string;
  asset: { code: string; issuer: string };
  total: string;
  payer: string;
  payerPublicKey: string;
  members: SplitMember[];
  memo: string;
  createdAt: string;
}

// ---------------------------------------------------------------- json files

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export const loadWallets = (): Wallet[] => readJson<Wallet[]>(WALLET_FILE, []);
export const saveWallets = (w: Wallet[]): void => writeJson(WALLET_FILE, w);
export const loadSplits = (): Split[] => readJson<Split[]>(SPLIT_FILE, []);
export const saveSplits = (s: Split[]): void => writeJson(SPLIT_FILE, s);

export function findWallet(label: string): Wallet {
  const w = loadWallets().find((x) => x.label === label);
  if (!w) throw new Error(`No wallet labelled "${label}". Run \`wallet list\` to see what exists.`);
  return w;
}

export function findSplit(id: string): Split {
  const s = loadSplits().find((x) => x.id === id || x.id.startsWith(id));
  if (!s) throw new Error(`No split with id "${id}". Run \`split list\`.`);
  return s;
}

// ------------------------------------------------------------------- secrets

/**
 * Secrets are encrypted at rest with AES-256-GCM under a scrypt-stretched
 * passphrase. These are testnet keys, but treating them as disposable is exactly
 * the habit that leaks a mainnet key at Black Belt.
 */
export function encryptSecret(secret: string, passphrase: string): EncryptedSecret {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

export function decryptSecret(enc: EncryptedSecret, passphrase: string): string {
  const key = crypto.scryptSync(passphrase, Buffer.from(enc.salt, 'base64'), 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(enc.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Wrong passphrase — could not decrypt wallet secret.');
  }
}

let cachedPassphrase: string | null = null;

export async function getPassphrase(): Promise<string> {
  if (cachedPassphrase !== null) return cachedPassphrase;
  const fromEnv = process.env.SPLITR_PASSPHRASE;
  if (fromEnv) {
    cachedPassphrase = fromEnv;
    return fromEnv;
  }
  if (!process.stdin.isTTY) {
    throw new Error('SPLITR_PASSPHRASE is not set and stdin is not a TTY — cannot prompt.');
  }
  cachedPassphrase = await promptHidden('Passphrase: ');
  return cachedPassphrase;
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Suppress echo of the typed characters, keeping only the prompt itself visible.
    // @ts-expect-error readline internal
    rl._writeToOutput = (s: string) => {
      if (s.includes(question)) process.stdout.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

export async function keypairFor(wallet: Wallet): Promise<Keypair> {
  const secret = decryptSecret(wallet.secret, await getPassphrase());
  return Keypair.fromSecret(secret);
}
