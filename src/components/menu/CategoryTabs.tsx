import React from 'react';
import { cn } from '@/lib/utils';
import { Beef, Coffee, IceCream, Leaf, Pizza, Sandwich, Soup, UtensilsCrossed } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({ 
  categories, 
  activeCategory, 
  onCategoryChange 
}) => {
  const iconFor = (name: string) => {
    const n = String(name || '').toLowerCase();
    if (n.includes('pizza')) return Pizza;
    if (n.includes('café') || n.includes('cafe') || n.includes('bebida') || n.includes('drink')) return Coffee;
    if (n.includes('sorvete') || n.includes('açaí') || n.includes('acai') || n.includes('sobremesa')) return IceCream;
    if (n.includes('veg') || n.includes('salada') || n.includes('fit') || n.includes('veget')) return Leaf;
    if (n.includes('sopa') || n.includes('caldo')) return Soup;
    if (n.includes('lanche') || n.includes('burger') || n.includes('hamb')) return Beef;
    if (n.includes('sand')) return Sandwich;
    return UtensilsCrossed;
  };

  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onCategoryChange(categoryId);
  };

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max px-1">
        {categories.map((category) => {
          const active = activeCategory === category.id;
          const Icon = iconFor(category.name);
          return (
            <button
              key={category.id}
              onClick={() => scrollToCategory(category.id)}
              className="flex flex-col items-center w-[74px] select-none"
              type="button"
            >
              <div
                className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center transition-colors",
                  active ? "bg-boracume-orange text-white" : "bg-orange-50 text-boracume-orange border border-orange-100"
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div
                className={cn(
                  "mt-2 text-[11px] font-semibold leading-tight text-center line-clamp-2",
                  active ? "text-gray-900" : "text-gray-700"
                )}
              >
                {category.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryTabs;
