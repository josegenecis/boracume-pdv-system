import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BannerManager from '@/components/banners/BannerManager';
import MarketingSettings from '@/components/marketing/MarketingSettings';
import MarketingBanners from '@/components/marketing/MarketingBanners';
import LoyaltyManager from '@/components/loyalty/LoyaltyManager';
import HighlightsManager from '@/components/marketing/HighlightsManager';
import UpsellManager from '@/components/marketing/UpsellManager';
import WhatsAppCampaignManager from '@/components/marketing/WhatsAppCampaignManager';
import PopMarketingAI from '@/components/marketing/PopMarketingAI';
import { Megaphone, Sparkles } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';

const TABS = [
  { value: 'banners', label: 'Artes e Banners' },
  { value: 'coupons', label: 'Cupons de Desconto' },
  { value: 'highlights', label: 'Produtos em Destaque' },
  { value: 'upsells', label: 'Venda Mais' },
  { value: 'pop-ai', label: 'Anúncios Automáticos' },
  { value: 'whatsapp', label: 'Envio em massa' },
  { value: 'loyalty', label: 'Clientes Fiéis' },
  { value: 'pixels', label: 'Facebook e Instagram' }
];

export default function Marketing() {
  const location = useLocation();
  const navigate = useNavigate();

  const tab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const t = String(params.get('tab') || '').trim();
    return TABS.some((x) => x.value === t) ? t : 'banners';
  }, [location.search]);

  const setTab = (next: string) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', next);
    navigate({ pathname: '/marketing', search: params.toString() }, { replace: true });
  };

  return (
    <div className="h-full w-full space-y-5 py-4 sm:py-6">
      <PageHero
        title="Propaganda e vendas"
        description="Crie campanhas, promoções e experiências de fidelidade com uma visão organizada do que está ativo."
        eyebrow="Central de crescimento"
        icon={Megaphone}
        actions={(
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
            <Sparkles className="h-4 w-4" />
            Marketing PopSystem
          </div>
        )}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-2xl border border-[#003223]/8 bg-white p-1.5 shadow-sm">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="shrink-0 rounded-xl px-4 py-2.5 data-[state=active]:bg-[#003223] data-[state=active]:text-white"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="banners" className="mt-5">
          <div className="space-y-4">
            <MarketingBanners />
            <BannerManager />
          </div>
        </TabsContent>
        <TabsContent value="coupons" className="mt-5">
          <LoyaltyManager />
        </TabsContent>
        <TabsContent value="highlights" className="mt-5">
          <HighlightsManager />
        </TabsContent>
        <TabsContent value="upsells" className="mt-5">
          <UpsellManager />
        </TabsContent>
        <TabsContent value="pop-ai" className="mt-5">
          <PopMarketingAI />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-5">
          <WhatsAppCampaignManager />
        </TabsContent>
        <TabsContent value="loyalty" className="mt-5">
          <LoyaltyManager />
        </TabsContent>
        <TabsContent value="pixels" className="mt-5">
          <MarketingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
