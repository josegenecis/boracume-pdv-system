import React from 'react';
import { Star } from 'lucide-react';
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
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Star className="h-4 w-4 text-yellow-500" />
        <h2 className="text-lg font-semibold text-gray-900">Destaques</h2>
        <span className="text-xs text-gray-500">Mais pedidos</span>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {products.map((product, index) => (
          <div
            key={product.id}
            onClick={() => onProductClick(product)}
            className="min-w-[160px] max-w-[160px] bg-white rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
          >
            <div className="relative">
              <div className="aspect-square w-full bg-gray-100">
                {product.image_url ? (
                  <img
                    src={normalizeImageUrlForDisplay(product.image_url) || product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading={index < 2 ? 'eager' : 'lazy'}
                    fetchPriority={index < 2 ? 'high' : 'auto'}
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-xs">Sem imagem</span>
                  </div>
                )}
              </div>
              <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-semibold">
                Mais pedido
              </div>
            </div>

            <div className="p-3">
              <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                {product.name}
              </h3>

              <div className="mt-2">
                {product.original_price && product.discount_percentage ? (
                  <div className="space-y-1">
                    <div className="flex items-end gap-2">
                      <span className="font-semibold text-gray-900">R$ {product.price.toFixed(2)}</span>
                      <span className="text-[11px] text-gray-500 line-through">R$ {Number(product.original_price).toFixed(2)}</span>
                    </div>
                    <div className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-semibold">
                      -{Math.round(Number(product.discount_percentage))}%
                    </div>
                  </div>
                ) : (
                  <div className="font-semibold text-gray-900">R$ {product.price.toFixed(2)}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HighlightsSection;
