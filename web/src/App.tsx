import { lazy, Suspense } from 'react';
import { IconContext } from '@phosphor-icons/react';
import { Nav } from './components/Nav.tsx';
import { Shell } from './components/Shell.tsx';
import { LanguageProvider } from './lib/i18n.tsx';
import { WalletProvider } from './lib/wallet.tsx';
import { useRoute } from './lib/useRoute.ts';
import { Hero } from './sections/Hero.tsx';
import { Problem } from './sections/Problem.tsx';
import { Positioning } from './sections/Positioning.tsx';
import { HowItWorks } from './sections/HowItWorks.tsx';
import { Bento } from './sections/Bento.tsx';
import { UnderTheHood } from './sections/UnderTheHood.tsx';
import { Stack } from './sections/Stack.tsx';
import { Faq } from './sections/Faq.tsx';
import { FinalCta } from './sections/FinalCta.tsx';
import { Footer } from './sections/Footer.tsx';

/**
 * `/app` pulls in `@stellar/stellar-sdk`, which is larger than this entire
 * landing page. Lazily, so a visitor who only reads the page never downloads
 * the chain client.
 */
const DApp = lazy(() => import('./app/DApp.tsx'));

export default function App() {
  const route = useRoute();

  return (
    <LanguageProvider>
      <WalletProvider>
        {/* One icon weight for the whole page, set once. */}
        <IconContext.Provider value={{ weight: 'light', size: 20 }}>
          <Shell />
          <Nav />
          {route === 'app' ? (
            <Suspense fallback={<div className="h-screen" />}>
              <DApp />
            </Suspense>
          ) : (
            <main className="relative">
              <Hero />
              <Problem />
              <Positioning />
              <HowItWorks />
              <Bento />
              <UnderTheHood />
              <Stack />
              <Faq />
              <FinalCta />
            </main>
          )}
          <Footer />
        </IconContext.Provider>
      </WalletProvider>
    </LanguageProvider>
  );
}
