import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BannerManager from '@/components/banners/BannerManager';
import MarketingSettings from '@/components/marketing/MarketingSettings';
import PromotionalBanner from '@/components/marketing/PromotionalBanner';
import LoyaltyManager from '@/components/loyalty/LoyaltyManager';
import HighlightsManager from '@/components/marketing/HighlightsManager';
import UpsellManager from '@/components/marketing/UpsellManager';

const TABS = [
  { value: 'banners', label: 'Banners' },
  { value: 'coupons', label: 'Cupons' },
  { value: 'highlights', label: 'Destaques' },
  { value: 'upsells', label: 'Upsells' },
  { value: 'loyalty', label: 'Fidelidade' },
  { value: 'pixels', label: 'Pixels' }
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
          <div className="text-2xl font-bold tracking-tight">Marketing</div>
          <div className="text-sm text-muted-foreground mt-1">
            Banners, cupons, destaques, upsells, fidelidade e pixels (Meta/Google).
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
            <PromotionalBanner autoPlay={false} />
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
