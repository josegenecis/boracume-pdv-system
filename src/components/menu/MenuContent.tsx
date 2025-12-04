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

  const categoriesToShow = categories.filter((c) => productsByCategory(c).length > 0);

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum produto disponível no momento.</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue={categoriesToShow[0]} className="w-full">
      <TabsList className="sticky top-0 z-20 flex w-full items-center gap-2 mb-6 h-12 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 rounded-none px-2 border-b shadow-sm overflow-x-auto whitespace-nowrap">
        {categoriesToShow.map(category => (
          <TabsTrigger 
            key={category} 
            value={category}
            className="flex-shrink-0 rounded-md min-w-[120px] h-10 px-4 text-sm font-medium data-[state=active]:bg-primary/5 data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
      
      {categoriesToShow.map(category => (
        <TabsContent key={category} value={category}>
          <div className="grid gap-4 sm:grid-cols-2">
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
