import React from 'react';
import PromotionalBanner from '@/components/marketing/PromotionalBanner';

export default function MarketingBanners({ restaurantId }: { restaurantId?: string }) {
  return (
    <div className="space-y-4">
      <PromotionalBanner restaurantId={restaurantId} variant="wide" />
      <PromotionalBanner restaurantId={restaurantId} variant="tile" autoPlay={false} />
    </div>
  );
}
