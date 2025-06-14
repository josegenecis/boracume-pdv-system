import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
  category?: string;
  user_id: string;
}

interface ProductCardProps {
  product: Product;
  onProductClick: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onProductClick }) => {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex">
        {product.image_url && (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-24 h-24 object-cover"
          />
        )}
        <div className="flex-1 p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{product.name}</h3>
              {product.description && (
                <p className="text-muted-foreground text-sm mt-1">
                  {product.description}
                </p>
              )}
              <p className="text-primary font-bold text-lg mt-2">
                R$ {product.price.toFixed(2)}
              </p>
            </div>
            <Button 
              onClick={() => {
                console.log('🔘 CLICK NO BOTÃO DO PRODUTO:', product.name);
                onProductClick(product);
              }}
              size="sm"
              className="ml-4"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};