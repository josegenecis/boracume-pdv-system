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
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 mb-6">
      <div className="flex overflow-x-auto scrollbar-hide py-4 px-4 space-x-6">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => scrollToCategory(category.id)}
            className={cn(
              "flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap",
              "hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
              activeCategory === category.id
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
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