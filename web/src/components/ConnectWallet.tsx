import { useLang } from '../lib/i18n.tsx';
import { shortAddress, useWallet } from '../lib/wallet.tsx';

/**
 * The nav's wallet control. Two states in one slot: an invitation, or the
 * account you are signed in as.
 *
 * Connected, it shows the truncated address rather than a green "Connected"
 * pill, because the useful question is *which* account — several of these
 * wallets hold more than one, and paying from the wrong one is the mistake
 * worth designing against.
 */
export function ConnectWallet({ className = '' }: { className?: string }) {
  const { t } = useLang();
  const { address, connecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        type="button"
        onClick={() => void disconnect()}
        title={`${address}\n${t.wallet.disconnect}`}
        aria-label={`${t.wallet.connected}: ${address}. ${t.wallet.disconnect}`}
        className={`group inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-[13px] whitespace-nowrap transition-colors duration-300 hover:border-foreground/25 ${className}`}
      >
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
        <span className="font-mono text-[12px] tracking-tight">{shortAddress(address)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void connect()}
      disabled={connecting}
      title={t.wallet.custody}
      className={`inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-[13px] whitespace-nowrap transition-colors duration-300 hover:border-foreground/25 disabled:opacity-60 ${className}`}
    >
      {connecting ? t.wallet.connecting : t.wallet.connect}
    </button>
  );
}
