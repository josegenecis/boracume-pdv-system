import React, { useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  track_stock?: boolean;
  stock_quantity?: number;
}

interface ProductCardProps {
  product: Product;
  onProductClick: (product: Product) => void;
  isAdding?: boolean;
  layout?: 'list' | 'grid';
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onProductClick, isAdding, layout = 'list' }) => {
  const [imageError, setImageError] = useState(false);

  const imageUrl = useMemo(() => {
    return normalizeImageUrlForDisplay(product.image_url);
  }, [product.image_url]);

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onProductClick(product);
  };

  if (layout === 'grid') {
    return (
      <div
        onClick={() => onProductClick(product)}
        className="bg-white rounded-[26px] shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      >
        <div className="relative">
          <div className="aspect-[4/3] w-full bg-gray-100">
            {imageUrl && !imageError ? (
              <img
                src={imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <span className="text-xs">Sem imagem</span>
              </div>
            )}
          </div>

          <div className="absolute bottom-3 left-3">
            {product.name.toLowerCase().includes('fartureia') ? (
              <div className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-boracume-orange shadow-sm">
                Pré-venda
              </div>
            ) : (
              <div className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-gray-900 shadow-sm">
                R$ {product.price.toFixed(2)}
              </div>
            )}
          </div>

          <Button
            type="button"
            size="icon"
            onClick={handleAddClick}
            disabled={!!isAdding}
            className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-boracume-orange hover:bg-boracume-orange/90 shadow-lg"
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>

        <div className="p-4">
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
    );
  }

  return (
    <div
      onClick={() => onProductClick(product)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 mb-2 text-lg">
            {product.name}
          </h3>

          {product.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {product.description}
            </p>
          )}

          {product.name.toLowerCase().includes('fartureia') ? (
            <span className="font-bold text-boracume-orange text-lg">
              Pré-venda
            </span>
          ) : product.original_price && product.discount_percentage ? (
            <div className="space-y-1">
              <div className="flex items-end gap-2">
                <span className="font-bold text-gray-900 text-lg">R$ {product.price.toFixed(2)}</span>
                <span className="text-sm text-gray-500 line-through">R$ {Number(product.original_price).toFixed(2)}</span>
              </div>
              <div className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-semibold">
                -{Math.round(Number(product.discount_percentage))}%
              </div>
            </div>
          ) : (
            <span className="font-bold text-black text-lg">
              R$ {product.price.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-end gap-2 flex-shrink-0">
          <Button
            type="button"
            size="icon"
            onClick={handleAddClick}
            disabled={!!isAdding}
            className="h-12 w-12 rounded-full bg-boracume-orange hover:bg-boracume-orange/90 shadow-lg"
          >
            {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6" />}
          </Button>

          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100">
            {imageUrl && !imageError ? (
              <img
                src={imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <span className="text-xs">Sem imagem</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
