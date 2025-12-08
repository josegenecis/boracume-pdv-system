import React from 'react';
import { Diamond } from 'lucide-react';

interface ClubDiscountBannerProps {
  discountPercentage?: number;
  onClick?: () => void;
}

const ClubDiscountBanner: React.FC<ClubDiscountBannerProps> = ({ 
  discountPercentage = 10, 
  onClick 
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
      <div 
        className="flex items-center justify-between max-w-md mx-auto cursor-pointer hover:bg-gray-50 rounded-lg p-3 transition-colors"
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          <div className="bg-orange-100 p-2 rounded-full">
            <Diamond className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Clube de Vantagens</h3>
            <p className="text-sm text-gray-600">
              Ganhe {discountPercentage}% de desconto em todos os produtos
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-medium">
            -{discountPercentage}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClubDiscountBanner;
