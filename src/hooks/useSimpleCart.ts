import { useState, useEffect } from 'react';
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
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('boracume_menu_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const { toast } = useToast();

  // Persistir carrinho
  useEffect(() => {
    localStorage.setItem('boracume_menu_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (
    product: CartProduct, 
    quantity: number = 1, 
    variations: string[] = [], 
    notes: string = '',
    variationPrice: number = 0
  ) => {
    console.log('🛒 Adicionando ao carrinho:', { product, quantity, variations, notes, variationPrice });

    // Garantir tipos numéricos para evitar NaN
    const basePrice = Number(product.price) || 0;
    const extraPrice = Number(variationPrice) || 0;
    
    // Garantir que variations seja um array de strings
    // Removida a restrição de vírgulas que causava bugs em nomes compostos
    const uniqueVariations = Array.from(new Set(
      (variations || []).filter(v => typeof v === 'string' && v.trim() !== '')
    ));

    // Criar ID único baseado no produto + variações + notas
    // Usamos pipe | como separador para evitar conflito com vírgulas nos nomes
    const uniqueId = `${product.id}|${uniqueVariations.sort().join('|')}|${notes.trim()}`;
    
    // Calcular preço total
    const totalPrice = (basePrice + extraPrice) * quantity;
    
    setCart(prev => {
      // Verificar se item já existe
      const existingIndex = prev.findIndex(item => item.uniqueId === uniqueId);

      if (existingIndex >= 0) {
        // Atualizar quantidade do item existente
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        updated[existingIndex].totalPrice = 
          (basePrice + extraPrice) * updated[existingIndex].quantity;

        console.log('🔄 Item atualizado:', updated[existingIndex]);
        
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
          notes: notes.trim(),
          totalPrice,
          uniqueId
        };

        console.log('➕ Novo item:', newItem);

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
        // Recalcular com base no preço unitário original implícito
        const unitPrice = item.totalPrice / item.quantity;
        return {
          ...item,
          quantity: newQuantity,
          totalPrice: unitPrice * newQuantity
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
    return cart.reduce((total, item) => total + (Number(item.totalPrice) || 0), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
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
