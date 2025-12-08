import React from 'react';
import { Diamond } from 'lucide-react';
import DiscountBadge from './DiscountBadge';

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

interface ProductCardProps {
  product: Product;
  onProductClick: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onProductClick }) => {
  return (
    <div
      onClick={() => onProductClick(product)}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex gap-4">
        {/* Conteúdo do lado esquerdo */}
        <div className="flex-1 min-w-0">
          {/* Nome do produto */}
          <h3 className="font-bold text-gray-900 mb-2 text-lg">
            {product.name}
          </h3>

          {/* Descrição */}
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {product.description}
          </p>

          {/* Preço com desconto ou preço normal */}
          {product.original_price && product.discount_percentage ? (
            <DiscountBadge
              originalPrice={product.original_price}
              discountedPrice={product.price}
              discountPercentage={product.discount_percentage}
            />
          ) : (
            <div className="flex items-center gap-1">
              <Diamond className="h-4 w-4 text-purple-600" />
              <span className="font-bold text-black text-lg">
                R$ {product.price.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Imagem do lado direito */}
        <div className="flex-shrink-0">
          <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
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