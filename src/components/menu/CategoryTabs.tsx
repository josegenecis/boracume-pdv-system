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
    <div className="sticky top-0 z-40 bg-white mb-6">
      <div className="flex overflow-x-auto scrollbar-hide py-3 px-4 space-x-6">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => scrollToCategory(category.id)}
            className={cn(
              "flex-shrink-0 px-0 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2",
              activeCategory === category.id
                ? "text-gray-900 border-gray-900"
                : "text-gray-600 border-transparent hover:text-gray-900"
            )}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryTabs;
