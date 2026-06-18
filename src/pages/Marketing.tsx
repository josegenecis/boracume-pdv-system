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
    <div className="h-full w-full py-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-2xl font-bold tracking-tight">Propaganda</div>
          <div className="text-sm text-muted-foreground mt-1">
            Artes, cupons, produtos em destaque, envio em massa e anúncios para vender mais.
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap justify-start h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="banners">
          <div className="space-y-4">
            <MarketingBanners />
            <BannerManager />
          </div>
        </TabsContent>
        <TabsContent value="coupons">
          <LoyaltyManager />
        </TabsContent>
        <TabsContent value="highlights">
          <HighlightsManager />
        </TabsContent>
        <TabsContent value="upsells">
          <UpsellManager />
        </TabsContent>
        <TabsContent value="pop-ai">
          <PopMarketingAI />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppCampaignManager />
        </TabsContent>
        <TabsContent value="loyalty">
          <LoyaltyManager />
        </TabsContent>
        <TabsContent value="pixels">
          <MarketingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
