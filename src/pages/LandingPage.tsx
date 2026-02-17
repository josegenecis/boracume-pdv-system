import React from 'react';
import { Helmet } from 'react-helmet-async';
import LandingLayout from '@/components/landing/LandingLayout';
import HeroSection from '@/components/landing/HeroSection';
import BenefitsSection from '@/components/landing/BenefitsSection';
import AiFeatureSection from '@/components/landing/AiFeatureSection';
import PricingSection from '@/components/landing/PricingSection';
import { ScrollToTop } from '@/components/landing/ScrollToTop';

const LandingPage = () => {
  return (
    <>
      <Helmet>
        <title>BoraCumê - O Fim das Taxas Abusivas de Delivery</title>
        <meta name="description" content="Liberte seu restaurante do caos no WhatsApp. O único sistema de Delivery e PDV com IA que cria sua loja digital em 1 minuto." />
      </Helmet>

      <LandingLayout>
        <HeroSection />
        <BenefitsSection />
        <AiFeatureSection />
        <PricingSection />
        <ScrollToTop />
      </LandingLayout>
    </>
  );
};

export default LandingPage;
