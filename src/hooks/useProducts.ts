
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category: string;
  available: boolean;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  display_order: number;
}

export const useProducts = (userId: string) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('product_categories')
          .select('*')
          .eq('user_id', userId)
          .eq('active', true)
          .order('display_order');

        if (categoriesError) throw categoriesError;

        // Fetch products
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', userId)
          .eq('available', true)
          .order('name');

        if (productsError) throw productsError;

        setCategories(categoriesData || []);
        setProducts(productsData || []);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching products:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId]);

  const getProductsByCategory = (categoryName: string) => {
    return products.filter(product => product.category === categoryName);
  };

  return {
    products,
    categories,
    loading,
    error,
    getProductsByCategory
  };
};
