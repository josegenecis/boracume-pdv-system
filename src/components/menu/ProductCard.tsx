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
        className="bg-white rounded-2xl shadow-sm border border-boracume-light overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
      >
        <div className="relative">
          <div className="aspect-square w-full bg-boracume-light/50">
            {imageUrl && !imageError ? (
              <img
                src={imageUrl}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <span className="text-xs">Sem imagem</span>
              </div>
            )}
          </div>

          <Button
            type="button"
            size="icon"
            onClick={handleAddClick}
            disabled={!!isAdding}
            className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-boracume-orange text-white hover:bg-boracume-orange/90 hover:scale-110 transition-all shadow-lg border-2 border-white"
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-boracume-dark-green text-sm leading-snug line-clamp-2 group-hover:text-boracume-green transition-colors">
            {product.name}
          </h3>

          {product.description && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="mt-3">
            {product.name.toLowerCase().includes('fartureia') ? (
              <span className="font-bold text-boracume-orange">Pré-venda</span>
            ) : product.original_price && product.discount_percentage ? (
              <div className="space-y-1">
                <div className="flex items-end gap-2">
                  <span className="font-bold text-boracume-dark-green">R$ {product.price.toFixed(2)}</span>
                  <span className="text-xs text-gray-400 line-through">R$ {Number(product.original_price).toFixed(2)}</span>
                </div>
                <div className="inline-flex items-center rounded-full bg-boracume-green/10 text-boracume-green px-2 py-0.5 text-xs font-semibold border border-boracume-green/20">
                  -{Math.round(Number(product.discount_percentage))}%
                </div>
              </div>
            ) : (
              <span className="font-bold text-boracume-dark-green">R$ {product.price.toFixed(2)}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onProductClick(product)}
      className="bg-white rounded-2xl shadow-sm border border-boracume-light px-3 py-3 cursor-pointer hover:shadow-md transition-all group"
    >
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-boracume-dark-green mb-1.5 text-base leading-snug group-hover:text-boracume-green transition-colors">
            {product.name}
          </h3>

          {product.description && (
            <p className="text-xs text-gray-500 mb-2 line-clamp-2">
              {product.description}
            </p>
          )}

          {product.name.toLowerCase().includes('fartureia') ? (
            <span className="font-semibold text-boracume-orange text-base">
              Pré-venda
            </span>
          ) : product.original_price && product.discount_percentage ? (
            <div className="space-y-1">
              <div className="flex items-end gap-2">
                <span className="font-semibold text-boracume-dark-green text-base">R$ {product.price.toFixed(2)}</span>
                <span className="text-xs text-gray-400 line-through">R$ {Number(product.original_price).toFixed(2)}</span>
              </div>
              <div className="inline-flex items-center rounded-full bg-boracume-green/10 text-boracume-green px-2 py-0.5 text-xs font-semibold border border-boracume-green/20">
                -{Math.round(Number(product.discount_percentage))}%
              </div>
            </div>
          ) : (
            <span className="font-semibold text-boracume-dark-green text-base">
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
            className="h-10 w-10 rounded-full bg-boracume-orange text-white hover:bg-boracume-orange/90 hover:scale-110 transition-all shadow-lg"
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>

          <div className="w-20 h-20 rounded-xl overflow-hidden bg-boracume-light/50">
            {imageUrl && !imageError ? (
              <img
                src={imageUrl}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
