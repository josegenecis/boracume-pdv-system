import React from 'react';
import { ChevronRight, Star } from 'lucide-react';
import { normalizeImageUrlForDisplay } from '@/utils/normalizeImageUrl';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  discount_percentage?: number;
  image_url?: string;
  order_count: number;
}

interface HighlightsSectionProps {
  products: Product[];
  onProductClick: (product: Product) => void;
}

const HighlightsSection: React.FC<HighlightsSectionProps> = ({ products, onProductClick }) => {
  if (!products || products.length === 0) return null;

  return (
    <div className="mb-7">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          <h2 className="text-lg font-extrabold text-gray-900">Mais vendidos</h2>
        </div>
        <div className="text-sm font-semibold text-boracume-orange inline-flex items-center gap-1">
          Ver tudo <ChevronRight className="h-4 w-4" />
        </div>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => onProductClick(product)}
            className="min-w-[170px] max-w-[170px] bg-white rounded-[22px] shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
          >
            <div className="relative">
              <div className="aspect-[4/3] w-full bg-gray-100">
                {product.image_url ? (
                  <img
                    src={normalizeImageUrlForDisplay(product.image_url) || product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-sm">Sem imagem</span>
                  </div>
                )}
              </div>
              <div className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-gray-900 shadow-sm">
                R$ {product.price.toFixed(2)}
              </div>
            </div>

            <div className="p-3">
              <h3 className="font-extrabold text-gray-900 text-sm leading-snug line-clamp-2">
                {product.name}
              </h3>

              {product.original_price && product.discount_percentage ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500 line-through">R$ {Number(product.original_price).toFixed(2)}</span>
                  <span className="text-[11px] font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                    -{Math.round(Number(product.discount_percentage))}%
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HighlightsSection;
