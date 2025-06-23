
import { useState } from 'react';

interface CartProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
}

interface CartItem {
  product: CartProduct;
  quantity: number;
  totalPrice: number;
  uniqueId: string;
  variations: string[];
  notes: string;
  variationPrice: number;
}

export const useDigitalCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: CartProduct, quantity: number = 1, variations: string[] = [], notes: string = '', variationPrice: number = 0) => {
    const uniqueId = `${product.id}-${Date.now()}`;
    const totalPrice = (product.price + variationPrice) * quantity;
    
    setCart(prev => [...prev, {
      product,
      quantity,
      totalPrice,
      uniqueId,
      variations,
      notes,
      variationPrice
    }]);
  };

  const updateQuantity = (uniqueId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(uniqueId);
      return;
    }

    setCart(prev => prev.map(item => {
      if (item.uniqueId === uniqueId) {
        return {
          ...item,
          quantity: newQuantity,
          totalPrice: (item.product.price + item.variationPrice) * newQuantity
        };
      }
      return item;
    }));
  };

  const removeFromCart = (uniqueId: string) => {
    setCart(prev => prev.filter(item => item.uniqueId !== uniqueId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.totalPrice, 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartItemCount
  };
};
