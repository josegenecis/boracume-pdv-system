
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
  variations: any[];
  notes: string;
}

export const useDigitalCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: CartProduct, quantity: number = 1, variations: any[] = [], notes: string = '') => {
    const uniqueId = `${product.id}-${Date.now()}`;
    const totalPrice = product.price * quantity;
    
    setCart(prev => [...prev, {
      product,
      quantity,
      totalPrice,
      uniqueId,
      variations,
      notes
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
          totalPrice: item.product.price * newQuantity
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
