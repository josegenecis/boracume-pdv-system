import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductCard } from './ProductCard';

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

interface MenuContentProps {
  products: Product[];
  categories: string[];
  onProductClick: (product: Product) => void;
}

export const MenuContent: React.FC<MenuContentProps> = ({ products, categories, onProductClick }) => {
  const productsByCategory = (category: string) => 
    products.filter(product => product.category === category);

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum produto disponível no momento.</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue={categories[0]} className="w-full">
      <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-6">
        {categories.map(category => (
          <TabsTrigger key={category} value={category}>
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
      
      {categories.map(category => (
        <TabsContent key={category} value={category}>
          <div className="grid gap-4">
            {productsByCategory(category).map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onProductClick={onProductClick}
              />
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
};