
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
  category?: string;
}

interface DigitalMenuContentProps {
  products: Product[];
  categories: string[];
  onProductClick: (product: Product) => void;
}

export const DigitalMenuContent: React.FC<DigitalMenuContentProps> = ({
  products,
  categories,
  onProductClick
}) => {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Nenhum produto disponível</h2>
        <p className="text-gray-600">Este restaurante ainda não possui produtos no cardápio.</p>
      </div>
    );
  }

  return (
    <>
      {categories.map(category => (
        <div key={category} className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            {category}
            <span className="text-sm font-normal text-gray-500">
              ({products.filter(p => p.category === category).length} produtos)
            </span>
          </h2>
          <div className="grid gap-4">
            {products.filter(p => p.category === category).map(product => (
              <Card key={product.id} className="p-4 hover:shadow-lg transition-shadow">
                <div className="flex gap-4">
                  {product.image_url && (
                    <img src={product.image_url} alt={product.name} className="w-20 h-20 rounded object-cover" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    {product.description && (
                      <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                    )}
                    <p className="text-primary font-bold text-lg mt-2">R$ {product.price.toFixed(2)}</p>
                  </div>
                  <Button onClick={() => onProductClick(product)} className="self-center">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};
