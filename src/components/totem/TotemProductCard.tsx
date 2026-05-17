import { useMemo, useState } from 'react';
import { Flame, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizeImageUrlForDisplay } from '@/utils/normalizeImageUrl';

interface TotemProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  original_price?: number;
  discount_percentage?: number;
  order_count?: number;
}

interface TotemProductCardProps {
  product: TotemProduct;
  onSelect: (product: TotemProduct) => void;
}

export default function TotemProductCard({ product, onSelect }: TotemProductCardProps) {
  const [imageError, setImageError] = useState(false);

  const imageUrl = useMemo(() => {
    return normalizeImageUrlForDisplay(product.image_url);
  }, [product.image_url]);

  return (
    <article className="group overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-xl">
      <button type="button" onClick={() => onSelect(product)} className="block w-full text-left">
        <div className="relative aspect-[4/3] bg-stone-100">
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-emerald-50 text-sm font-semibold text-stone-400">
              Sem imagem
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {Number(product.discount_percentage || 0) > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-boracume-orange px-2.5 py-1 text-xs font-extrabold text-white shadow">
                <Flame className="h-3.5 w-3.5" />
                -{Math.round(Number(product.discount_percentage))}%
              </span>
            ) : null}
            {Number(product.order_count || 0) >= 10 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-extrabold text-white shadow">
                <Sparkles className="h-3.5 w-3.5" />
                Favorito
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 p-4">
          <h3 className="min-h-[3.25rem] text-xl font-extrabold leading-tight text-stone-950 line-clamp-2">
            {product.name}
          </h3>
          <p className="min-h-[2.5rem] text-sm leading-relaxed text-stone-600 line-clamp-2">
            {product.description || 'Produto preparado na hora.'}
          </p>
        </div>
      </button>

      <div className="flex items-center justify-between gap-3 border-t border-stone-100 p-4">
        <div>
          {product.original_price && product.original_price > product.price ? (
            <div className="text-xs font-semibold text-stone-400 line-through">
              R$ {Number(product.original_price).toFixed(2)}
            </div>
          ) : null}
          <div className="text-2xl font-extrabold text-boracume-orange">
            R$ {Number(product.price || 0).toFixed(2)}
          </div>
        </div>
        <Button
          type="button"
          onClick={() => onSelect(product)}
          className="h-12 rounded-lg bg-boracume-orange px-4 text-base font-extrabold text-white hover:bg-boracume-orange/90"
        >
          <Plus className="mr-2 h-5 w-5" />
          Adicionar
        </Button>
      </div>
    </article>
  );
}
