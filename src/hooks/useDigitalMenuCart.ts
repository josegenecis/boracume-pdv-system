
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
}

interface CartItem extends Product {
  quantity: number;
  selectedOptions?: string[];
  notes?: string;
  subtotal: number;
}

export const useDigitalMenuCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addToCart = (product: Product, quantity: number = 1, selectedVariations: any[] = [], notes: string = '') => {
    const selectedOptions = selectedVariations.flatMap(variation => 
      variation.options.map((option: any) => option.name)
    );
    
    const variationPrice = selectedVariations.reduce((total, variation) => 
      total + variation.options.reduce((vTotal: number, option: any) => vTotal + option.price, 0), 0
    );
    
    const itemPrice = product.price + variationPrice;
    const subtotal = itemPrice * quantity;
    
    const newItem: CartItem = {
      ...product,
      quantity,
      selectedOptions,
      notes,
      subtotal
    };

    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        item.id === product.id &&
        JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions) &&
        item.notes === notes
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        updated[existingIndex].subtotal = (updated[existingIndex].price + variationPrice) * updated[existingIndex].quantity;
        return updated;
      }

      return [...prev, newItem];
    });

    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  const updateCartItem = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }

    setCart(prev => {
      const updated = [...prev];
      const item = updated[index];
      const basePrice = item.subtotal / item.quantity; // Get price per unit including variations
      updated[index] = {
        ...item,
        quantity,
        subtotal: basePrice * quantity
      };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  return {
    cart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartItemCount
  };
};
