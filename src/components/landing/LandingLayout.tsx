import React from 'react';
import Header from './Header';
import Footer from './Footer';
import { MarketingScrollTracker } from './MarketingScrollTracker';

interface LandingLayoutProps {
  children: React.ReactNode;
}

const LandingLayout: React.FC<LandingLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-white selection:bg-[#ef6c20] selection:text-white">
      <MarketingScrollTracker />
      <Header />
      <main className="flex-1 pt-[72px]">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default LandingLayout;
