import { useLang } from './i18n.tsx';
import { navigate } from './useRoute.ts';
import { useWallet } from './wallet.tsx';

/**
 * The landing page's primary call to action: bring a wallet, then go to /app.
 *
 * It opens the real wallet modal rather than scrolling to the demo, because a
 * button labelled "Connect wallet" that moves the page instead is a lie. And it
 * routes to /app on success, because that is the only way in from the landing
 * page now that the nav's "App" link is gone.
 *
 * Shared by Nav and Hero rather than written twice: the two say the same thing
 * and would otherwise drift the moment one of the three states changes.
 */
export function useWalletCta() {
  const { t } = useLang();
  const { address, connecting, connect } = useWallet();

  const onClick = () => {
    // Already attached — a returning visitor has their wallet restored on load,
    // so there is nothing to ask for and the click is just the way through.
    if (address) {
      navigate('/app');
      return;
    }
    void connect().then((chosen) => {
      // Null means the modal was dismissed. Staying put is the right answer.
      if (chosen) navigate('/app');
    });
  };

  return {
    label: connecting ? t.wallet.connecting : address ? t.wallet.openApp : t.wallet.connect,
    busy: connecting,
    /** The custody answer, said where the decision is made. */
    title: t.wallet.custody,
    onClick,
  };
}
