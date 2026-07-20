import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Analytics } from '@vercel/analytics/react';
import LandingPage from '@/pages/LandingPage';
import LegalPage from '@/pages/LegalPage';

export default function LandingApp() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/termos" element={<LegalPage />} />
          <Route path="/privacidade" element={<LegalPage />} />
          <Route path="/lgpd" element={<LegalPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Analytics />
    </HelmetProvider>
  );
}
