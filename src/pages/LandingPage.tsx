import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Suspense, lazy } from 'react';
import LandingLayout from '@/components/landing/LandingLayout';
import HeroSection from '@/components/landing/HeroSection';
import { PageLoader } from '@/components/landing/LoadingSpinner';
import { ScrollToTop } from '@/components/landing/ScrollToTop';
import { usePerformanceMonitor } from '@/hooks/useOptimizedAnimation';

// Lazy loading dos componentes para melhor performance
const BenefitsSection = lazy(() => import('@/components/landing/BenefitsSection'));
const FeaturesSection = lazy(() => import('@/components/landing/FeaturesSection'));
const TestimonialsSection = lazy(() => import('@/components/landing/TestimonialsSection'));
const PricingSection = lazy(() => import('@/components/landing/PricingSection'));
const ContactForm = lazy(() => import('@/components/landing/ContactForm'));

const LandingPage = () => {
  // Monitor de performance para desenvolvimento
  usePerformanceMonitor();

  return (
    <>
      <Helmet>
        <title>BoraCumê - Sistema Completo para Restaurantes | Aumente suas Vendas em 40%</title>
        <meta name="description" content="Transforme seu restaurante com o BoraCumê. Cardápio digital, gestão completa, pagamentos integrados e muito mais. Aumente suas vendas em até 40% e reduza custos em 25%. Teste grátis por 14 dias!" />
        <meta name="keywords" content="sistema restaurante, cardápio digital, gestão restaurante, PDV restaurante, delivery, ifood, uber eats, rappi, gestão estoque, controle financeiro" />
        
        {/* Performance hints */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.boracume.com.br" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://boracume.com.br/" />
        <meta property="og:title" content="BoraCumê - Sistema Completo para Restaurantes" />
        <meta property="og:description" content="Aumente suas vendas em 40% com o sistema mais completo para restaurantes. Cardápio digital, gestão e pagamentos integrados." />
        <meta property="og:image" content="https://boracume.com.br/og-image.jpg" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://boracume.com.br/" />
        <meta property="twitter:title" content="BoraCumê - Sistema Completo para Restaurantes" />
        <meta property="twitter:description" content="Aumente suas vendas em 40% com o sistema mais completo para restaurantes." />
        <meta property="twitter:image" content="https://boracume.com.br/og-image.jpg" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "BoraCumê",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web, iOS, Android",
            "description": "Sistema completo de gestão para restaurantes com cardápio digital, PDV e integração com delivery",
            "offers": {
              "@type": "Offer",
              "price": "97.00",
              "priceCurrency": "BRL",
              "priceValidUntil": "2024-12-31"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "reviewCount": "1247"
            }
          })}
        </script>
      </Helmet>

      <LandingLayout>
        <HeroSection />
        
        <Suspense fallback={<PageLoader />}>
          <BenefitsSection />
          <FeaturesSection />
          <TestimonialsSection />
          <PricingSection />
          <ContactForm />
        </Suspense>
        
        <ScrollToTop />
      </LandingLayout>
    </>
  );
};

export default LandingPage;