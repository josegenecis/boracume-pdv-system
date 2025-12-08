import React from 'react';
import { Diamond } from 'lucide-react';

interface DiscountBadgeProps {
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  showIcon?: boolean;
}

const DiscountBadge: React.FC<DiscountBadgeProps> = ({ 
  originalPrice, 
  discountedPrice, 
  discountPercentage,
  showIcon = true
}) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        {showIcon && <Diamond className="h-4 w-4 text-orange-600" />}
        <span className="font-bold text-black text-lg">
          R$ {discountedPrice.toFixed(2)}
        </span>
      </div>
      <span className="text-gray-400 line-through text-sm">
        R$ {originalPrice.toFixed(2)}
      </span>
      <span className="bg-orange-600 text-white px-2 py-1 rounded-full text-xs font-medium">
        -{discountPercentage}%
      </span>
    </div>
  );
};

export default DiscountBadge;
