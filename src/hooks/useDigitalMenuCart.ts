
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
  variationPrice: number;
}

export const useDigitalMenuCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addToCart = (product: Product, quantity: number = 1, selectedVariations: any[] = [], notes: string = '') => {
    console.log('🔄 Adicionando ao carrinho:', {
      product: product.name,
      quantity,
      selectedVariations,
      notes
    });

    const selectedOptions = selectedVariations.flatMap(variation => 
      Array.isArray(variation.options) ? variation.options.map((option: any) => option.name) : []
    );
    
    const variationPrice = selectedVariations.reduce((total, variation) => {
      if (Array.isArray(variation.options)) {
        return total + variation.options.reduce((vTotal: number, option: any) => vTotal + (option.price || 0), 0);
      }
      return total;
    }, 0);
    
    const itemPrice = product.price + variationPrice;
    const subtotal = itemPrice * quantity;
    
    console.log('💰 Cálculo de preços:', {
      basePrice: product.price,
      variationPrice,
      itemPrice,
      quantity,
      subtotal
    });
    
    const newItem: CartItem = {
      ...product,
      quantity,
      selectedOptions,
      notes,
      subtotal,
      variationPrice
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
        updated[existingIndex].subtotal = (updated[existingIndex].price + updated[existingIndex].variationPrice) * updated[existingIndex].quantity;
        console.log('✅ Item existente atualizado');
        return updated;
      }

      console.log('✅ Novo item adicionado ao carrinho');
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
      const basePrice = item.price + item.variationPrice;
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
