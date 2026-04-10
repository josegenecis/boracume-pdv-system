import React from 'react';
import { cn } from '@/lib/utils';

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
  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onCategoryChange(categoryId);
  };

  return (
    <div className="scrollbar-hide flex overflow-x-auto py-3 px-4 space-x-6 bg-white">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => scrollToCategory(category.id)}
          className={cn(
            "flex-shrink-0 px-0 py-2 text-sm font-semibold whitespace-nowrap border-b-2",
            activeCategory === category.id
              ? "text-black border-black"
              : "text-black border-transparent"
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
};

export default CategoryTabs;
