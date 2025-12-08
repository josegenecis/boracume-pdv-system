import React from 'react';
import { Star } from 'lucide-react';
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

interface HighlightsSectionProps {
  products: Product[];
  onProductClick: (product: Product) => void;
}

const HighlightsSection: React.FC<HighlightsSectionProps> = ({ products, onProductClick }) => {
  if (!products || products.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 text-yellow-500" />
        <h2 className="text-xl font-bold text-gray-900">Destaques</h2>
        <span className="text-sm text-gray-500">Mais pedidos</span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => onProductClick(product)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            {/* Imagem do produto */}
            <div className="aspect-square w-full mb-3 rounded-lg overflow-hidden bg-gray-100">
              {product.image_url ? (
                <img
                  src={product.image_url}
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

            {/* Badge de mais pedido */}
            <div className="flex items-center gap-1 mb-2">
              <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                Mais pedido
              </div>
              <span className="text-xs text-gray-500">
                {product.order_count} pedidos
              </span>
            </div>

            {/* Nome do produto */}
            <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
              {product.name}
            </h3>

            {/* Descrição */}
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {product.description}
            </p>

            {/* Preço com desconto */}
            {product.original_price && product.discount_percentage ? (
              <DiscountBadge
                originalPrice={product.original_price}
                discountedPrice={product.price}
                discountPercentage={product.discount_percentage}
                showIcon={false}
              />
            ) : (
              <div className="font-bold text-black text-lg">
                R$ {product.price.toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HighlightsSection;