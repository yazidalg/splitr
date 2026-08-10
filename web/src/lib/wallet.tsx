/**
 * Wallet connection for the browser.
 *
 * The CLI holds keys and signs with them. The page does not, and must not: the
 * README flags custody as this project's unresolved regulatory exposure, and a
 * marketing site that asks for a secret key is the wrong answer to it. Here the
 * user brings their own wallet, signs in their own extension, and Splitr never
 * sees a secret.
 *
 * Stellar Wallets Kit rather than Freighter alone, because "install Freighter"
 * is a real drop-off for an Indonesian visitor who already uses Lobstr on their
 * phone. The kit is one interface over all of them.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
/** Remembers which wallet was chosen, so a return visit does not re-ask. */
export const WALLET_KEY = 'splitr-wallet';

/**
 * Hard-coded rather than imported from the kit's `Networks` enum, because
 * importing a value would pull the kit into the main bundle and undo the
 * dynamic import below.
 */
export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

type Kit = (typeof import('@creit.tech/stellar-wallets-kit'))['StellarWalletsKit'];

let kitPromise: Promise<Kit> | null = null;

/**
 * Loads and initialises the kit, once.
 *
 * Dynamically, because the kit and its six wallet modules are 209 kB — 73% on
 * top of everything else this page ships — and most visitors read the page
 * without ever connecting anything. They should not pay for the modal. The
 * import resolves on first use: a click, or a restore for someone who
 * connected before.
 *
 * The kit is a singleton of static methods, so the promise is the lock:
 * concurrent callers await the same initialisation rather than racing to
 * rebuild the module list under a live modal.
 */
function loadKit(): Promise<Kit> {
  kitPromise ??= (async () => {
    const [
      { StellarWalletsKit, Networks },
      { FreighterModule },
      { xBullModule },
      { AlbedoModule },
      { LobstrModule },
      { HanaModule },
      { RabetModule },
    ] = await Promise.all([
      import('@creit.tech/stellar-wallets-kit'),
      import('@creit.tech/stellar-wallets-kit/modules/freighter'),
      import('@creit.tech/stellar-wallets-kit/modules/xbull'),
      import('@creit.tech/stellar-wallets-kit/modules/albedo'),
      import('@creit.tech/stellar-wallets-kit/modules/lobstr'),
      import('@creit.tech/stellar-wallets-kit/modules/hana'),
      import('@creit.tech/stellar-wallets-kit/modules/rabet'),
    ]);

    StellarWalletsKit.init({
      network: Networks.TESTNET,
      selectedWalletId: readStored() ?? undefined,
      modules: [
        new FreighterModule(),
        new xBullModule(),
        new AlbedoModule(),
        new LobstrModule(),
        new HanaModule(),
        new RabetModule(),
      ],
    });
    return StellarWalletsKit;
  })();
  return kitPromise;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(WALLET_KEY);
  } catch {
    return null;
  }
}

type WalletValue = {
  /** The connected account, or null when nobody is connected. */
  address: string | null;
  connecting: boolean;
  /** Set when the last attempt failed; cleared on the next one. */
  error: string | null;
  /**
   * Opens the wallet chooser and resolves with the account picked, or null if
   * the modal was dismissed or the attempt failed.
   *
   * It returns the address rather than leaving callers to read `address` back,
   * because the state this sets is not visible in the closure that awaited it —
   * and the landing page's CTA has to know whether to move to /app.
   */
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  /**
   * Signs an unsigned transaction envelope. Shaped to match what
   * `contract.Client` expects for `signTransaction`, so the same client code
   * runs here and in the CLI.
   */
  signTransaction: (
    xdr: string,
    opts?: { networkPassphrase?: string },
  ) => Promise<{ signedTxXdr: string; signerAddress?: string }>;
};

const WalletContext = createContext<WalletValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A wallet chosen on a previous visit is restored silently. `getAddress`
  // reads the kit's memory rather than prompting, so a visitor who has not
  // authorised this origin sees no popup on page load.
  useEffect(() => {
    // No stored choice means a first-time visitor, who should not download the
    // kit just by loading the page.
    if (!readStored()) return;
    let cancelled = false;
    loadKit()
      .then((kit) => kit.getAddress())
      .then(({ address: restored }) => {
        if (!cancelled && restored) setAddress(restored);
      })
      .catch(() => {
        // Wallet locked, uninstalled, or permission withdrawn. Staying
        // disconnected is the correct outcome, and not worth an error.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback<WalletValue['connect']>(async () => {
    setConnecting(true);
    setError(null);
    try {
      const kit = await loadKit();
      const { address: chosen } = await kit.authModal();
      setAddress(chosen);
      try {
        localStorage.setItem(WALLET_KEY, kit.selectedModule.productId);
      } catch {
        // Choice still applies for this visit.
      }
      return chosen;
    } catch (err) {
      // Closing the modal rejects too; that is a decision, not a failure.
      const message = err instanceof Error ? err.message : String(err);
      if (!/clos|cancel|reject|dismiss/i.test(message)) setError(message);
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await (await loadKit()).disconnect();
    } finally {
      try {
        localStorage.removeItem(WALLET_KEY);
      } catch {
        // Nothing to clean up.
      }
      setAddress(null);
      setError(null);
    }
  }, []);

  const signTransaction = useCallback<WalletValue['signTransaction']>(
    async (xdr, opts) =>
      (await loadKit()).signTransaction(xdr, {
        networkPassphrase: opts?.networkPassphrase ?? TESTNET_PASSPHRASE,
        ...(address ? { address } : {}),
      }),
    [address],
  );

  const value = useMemo(
    () => ({ address, connecting, error, connect, disconnect, signTransaction }),
    [address, connecting, error, connect, disconnect, signTransaction],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be called inside WalletProvider');
  return ctx;
}

/** G-addresses are 56 characters. Nobody reads one whole. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
