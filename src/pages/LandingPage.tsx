import React from 'react';
import { Helmet } from 'react-helmet-async';
import LandingLayout from '@/components/landing/LandingLayout';
import HeroSection from '@/components/landing/HeroSection';
import BenefitsSection from '@/components/landing/BenefitsSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import PricingSection from '@/components/landing/PricingSection';
import ContactForm from '@/components/landing/ContactForm';
import { ScrollToTop } from '@/components/landing/ScrollToTop';

const LandingPage = () => {
  console.log("LANDING PAGE V3 LOADED");

  return (
    <>
      <Helmet>
        <title>BoraCumê - O Salvador da Pátria do seu Restaurante</title>
        <meta name="description" content="Chega de caos. Organize pedidos, cozinha e financeiro em um só lugar. Teste grátis por 30 dias." />
      </Helmet>

      <LandingLayout>
        <HeroSection />
        <BenefitsSection />
        <FeaturesSection />
        {/* Testimonials temporariamente oculto pois nao temos clientes reais ainda */}
        {/* <TestimonialsSection /> */}
        <PricingSection />
        <ContactForm />
        
        <ScrollToTop />
      </LandingLayout>
    </>
  );
};

export default LandingPage;