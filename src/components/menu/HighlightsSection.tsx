import React from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { normalizeImageUrlForDisplay } from '@/utils/normalizeImageUrl';
import AutoplayVideo from '@/components/media/AutoplayVideo';
import { isVideoAsset } from '@/utils/videoAutoplay';

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
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: 'var(--menu-primary, #85C441)' }} />
        <div>
          <h2 className="text-xl font-black" style={{ color: 'var(--menu-secondary, #063D2E)' }}>Mais pedidos</h2>
          <p className="text-xs text-slate-500">Os favoritos dos clientes</p>
        </div>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {products.map((product, index) => {
          const mediaUrl = normalizeImageUrlForDisplay(product.image_url) || product.image_url || '';

          return (
          <div
            key={product.id}
            onClick={() => onProductClick(product)}
            className="min-w-[210px] max-w-[210px] overflow-hidden rounded-[24px] border border-white bg-white shadow-[0_16px_40px_-28px_rgba(15,23,42,.65)] transition-all hover:-translate-y-1 hover:shadow-lg sm:min-w-[230px] sm:max-w-[230px]"
          >
            <div className="relative">
              <div className="aspect-[4/3] w-full bg-[#f8f5ef]">
                {mediaUrl ? (
                  isVideoAsset(mediaUrl) ? (
                    <AutoplayVideo
                      src={mediaUrl}
                      className="w-full h-full object-cover"
                      loop
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading={index < 2 ? 'eager' : 'lazy'}
                      fetchPriority={index < 2 ? 'high' : 'auto'}
                      decoding="async"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-xs">Sem imagem</span>
                  </div>
                )}
              </div>
              <div className="absolute left-3 top-3 rounded-full bg-[var(--menu-secondary,#063D2E)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                {index === 0 ? 'Campeão de vendas' : 'Popular'}
              </div>
            </div>

            <div className="p-4">
              <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                {product.name}
              </h3>

              {product.description ? <p className="mt-1 line-clamp-2 min-h-[32px] text-xs leading-relaxed text-slate-500">{product.description}</p> : <div className="min-h-[36px]" />}
              {Number(product.order_count || 0) > 0 && <p className="mt-2 text-[11px] font-semibold text-slate-400">{product.order_count} pedidos realizados</p>}
              <div className="mt-3 flex items-end justify-between gap-2">
                {product.original_price && product.discount_percentage ? (
                  <div className="space-y-1">
                    <div className="flex items-end gap-2">
                      <span className="text-base font-black tracking-normal" style={{ color: 'var(--menu-price, #EF6C20)' }}>R$ {product.price.toFixed(2)}</span>
                      <span className="text-[11px] text-gray-500 line-through">R$ {Number(product.original_price).toFixed(2)}</span>
                    </div>
                    <div className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-semibold">
                      -{Math.round(Number(product.discount_percentage))}%
                    </div>
                  </div>
                ) : (
                  <div className="text-base font-black tracking-normal" style={{ color: 'var(--menu-price, #EF6C20)' }}>R$ {product.price.toFixed(2)}</div>
                )}
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-white shadow-md" style={{ backgroundColor: 'var(--menu-primary, #85C441)' }}><Plus className="h-5 w-5" /></span>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default HighlightsSection;
