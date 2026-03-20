import React from 'react';
import PromotionalBanner from '@/components/marketing/PromotionalBanner';

export default function MarketingBanners({
  restaurantId,
  onSelectProductId
}: {
  restaurantId?: string;
  onSelectProductId?: (productId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <PromotionalBanner restaurantId={restaurantId} variant="wide" onSelectProductId={onSelectProductId} />
      <PromotionalBanner restaurantId={restaurantId} variant="tile" autoPlay={false} onSelectProductId={onSelectProductId} />
    </div>
  );
}
