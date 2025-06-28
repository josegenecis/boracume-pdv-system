
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductCard } from './ProductCard';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category: string;
  available: boolean;
  user_id: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface MenuContentProps {
  products: Product[];
  categories: Category[];
  onProductClick: (product: Product) => void;
}

export const MenuContent: React.FC<MenuContentProps> = ({
  products,
  categories,
  onProductClick
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Filtrar apenas produtos disponíveis
  const availableProducts = products.filter(product => product.available);

  // Agrupar produtos por categoria
  const productsByCategory = availableProducts.reduce((acc, product) => {
    const category = product.category || 'Outros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // Obter categorias que têm produtos disponíveis
  const availableCategories = Object.keys(productsByCategory);

  // Definir categoria padrão se não houver seleção
  const defaultCategory = availableCategories[0];
  const activeCategory = selectedCategory || defaultCategory;

  if (availableProducts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Nenhum produto disponível no momento.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Tabs value={activeCategory} onValueChange={setSelectedCategory} className="w-full">
        {/* Tabs List com scroll horizontal em mobile e posição sticky */}
        <div className="sticky top-0 bg-white z-20 border-b mb-6 shadow-sm">
          <div className="max-w-4xl mx-auto px-4">
            <TabsList className="h-12 w-full justify-start overflow-x-auto overflow-y-hidden bg-gray-50 p-1 rounded-lg">
              <div className="flex space-x-1 min-w-max px-2">
                {availableCategories.map((category) => (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="whitespace-nowrap px-4 py-2 text-sm font-medium transition-all duration-200 
                             data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm
                             hover:bg-white/50 flex-shrink-0 min-w-fit"
                  >
                    {category}
                    <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                      {productsByCategory[category].length}
                    </span>
                  </TabsTrigger>
                ))}
              </div>
            </TabsList>
          </div>
        </div>

        {/* Conteúdo das categorias */}
        <div className="space-y-6">
          {availableCategories.map((category) => (
            <TabsContent key={category} value={category} className="mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">{category}</h2>
                  <span className="text-sm text-gray-500">
                    {productsByCategory[category].length} produtos
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {productsByCategory[category].map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onClick={() => onProductClick(product)}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
};
