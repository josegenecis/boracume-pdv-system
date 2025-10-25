import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CartProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
}

interface CartItem {
  product: CartProduct;
  quantity: number;
  variations: string[];
  notes: string;
  totalPrice: number;
  uniqueId: string; // Para distinguir mesmo produto com variações diferentes
}

export const useSimpleCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addToCart = (
    product: CartProduct, 
    quantity: number = 1, 
    variations: string[] = [], 
    notes: string = '',
    variationPrice: number = 0
  ) => {

    // Garantir que variations seja um array de strings únicas e sem strings agrupadas
    const uniqueVariations = Array.from(new Set(
      variations.filter(v => typeof v === 'string' && !v.includes(','))
    ));
    // Criar ID único baseado no produto + variações + notas
    const uniqueId = `${product.id}-${uniqueVariations.sort().join(',')}-${notes}`;
    // Calcular preço total
    const totalPrice = (product.price + variationPrice) * quantity;
    setCart(prev => {
      // Verificar se item já existe
      const existingIndex = prev.findIndex(item => item.uniqueId === uniqueId);

      if (existingIndex >= 0) {
        // Atualizar quantidade do item existente
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        updated[existingIndex].totalPrice = 
          (product.price + variationPrice) * updated[existingIndex].quantity;


        toast({
          title: "Produto atualizado",
          description: `${product.name} - quantidade: ${updated[existingIndex].quantity}`,
        });


        return updated;
      } else {
        // Adicionar novo item
        const newItem: CartItem = {
          product,
          quantity,

          variations: uniqueVariations,

          notes,
          totalPrice,
          uniqueId
        };


        toast({
          title: "Adicionado ao carrinho",
          description: `${product.name} - ${quantity}x`,
        });


        return [...prev, newItem];
      }
    });
  };

  const updateQuantity = (uniqueId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(uniqueId);
      return;
    }

    setCart(prev => prev.map(item => {
      if (item.uniqueId === uniqueId) {
        const basePrice = item.totalPrice / item.quantity; // Preço unitário atual
        return {
          ...item,
          quantity: newQuantity,
          totalPrice: basePrice * newQuantity
        };
      }
      return item;
    }));
  };

  const removeFromCart = (uniqueId: string) => {
    setCart(prev => prev.filter(item => item.uniqueId !== uniqueId));
    toast({
      title: "Item removido",
      description: "O item foi removido do carrinho.",
    });
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