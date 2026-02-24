import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    const v = (product.image_url || '').trim();
    if (!v || v === 'null' || v === 'undefined' || v === '[object Object]') return '';
    if (v.startsWith('//')) return `https:${v}`;
    if (v.startsWith('http://')) return `https://${v.slice('http://'.length)}`;
    if (v.startsWith('https://') || v.startsWith('data:') || v.startsWith('blob:')) return v;
    if (v.includes('ifood-static.com.br') || v.includes('ifood-static.com')) return `https://${v}`;
    return '';
  }, [product.image_url]);

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="text-left bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="aspect-[4/3] bg-slate-100">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
            Sem imagem
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="font-extrabold text-slate-900 text-lg leading-tight line-clamp-2">{product.name}</div>
        <div className="text-sm text-slate-600 mt-1 line-clamp-2">{product.description}</div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xl font-extrabold text-boracume-orange">
            R$ {Number(product.price || 0).toFixed(2)}
          </div>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(product);
            }}
            className="bg-boracume-orange hover:bg-boracume-orange/90 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>
    </button>
  );
}
