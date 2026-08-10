import { IconContext } from '@phosphor-icons/react';
import { Nav } from './components/Nav.tsx';
import { Shell } from './components/Shell.tsx';
import { LanguageProvider } from './lib/i18n.tsx';
import { Hero } from './sections/Hero.tsx';
import { Problem } from './sections/Problem.tsx';
import { Positioning } from './sections/Positioning.tsx';
import { HowItWorks } from './sections/HowItWorks.tsx';
import { Bento } from './sections/Bento.tsx';
import { UnderTheHood } from './sections/UnderTheHood.tsx';
import { Faq } from './sections/Faq.tsx';
import { FinalCta } from './sections/FinalCta.tsx';
import { Footer } from './sections/Footer.tsx';

export default function App() {
  return (
    <LanguageProvider>
      {/* One icon weight for the whole page, set once. */}
      <IconContext.Provider value={{ weight: 'light', size: 20 }}>
        <Shell />
        <Nav />
        <main className="relative">
          <Hero />
          <Problem />
          <Positioning />
          <HowItWorks />
          <Bento />
          <UnderTheHood />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </IconContext.Provider>
    </LanguageProvider>
  );
}
