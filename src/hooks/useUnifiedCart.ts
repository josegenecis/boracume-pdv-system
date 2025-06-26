
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface CartProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
}

export interface CartVariation {
  name: string;
  price: number;
}

export interface CartItem {
  id: string; // unique identifier for this cart item
  product: CartProduct;
  quantity: number;
  variations: CartVariation[];
  notes: string;
  unitPrice: number; // price per unit including variations
  totalPrice: number; // unitPrice * quantity
}

export const useUnifiedCart = () => {
  const [items, setItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addItem = (
    product: CartProduct,
    quantity: number = 1,
    variations: CartVariation[] = [],
    notes: string = ''
  ) => {
    const variationPrice = variations.reduce((sum, v) => sum + v.price, 0);
    const unitPrice = product.price + variationPrice;
    
    // Create unique ID based on product + variations + notes
    const variationKey = variations.map(v => v.name).sort().join(',');
    const uniqueId = `${product.id}-${variationKey}-${notes}`;
    
    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.id === uniqueId);
      
      if (existingIndex >= 0) {
        // Update existing item
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        updated[existingIndex].totalPrice = updated[existingIndex].unitPrice * updated[existingIndex].quantity;
        
        toast({
          title: "Item atualizado no carrinho",
          description: `${product.name} - Quantidade: ${updated[existingIndex].quantity}`,
        });
        
        return updated;
      } else {
        // Add new item
        const newItem: CartItem = {
          id: uniqueId,
          product,
          quantity,
          variations,
          notes,
          unitPrice,
          totalPrice: unitPrice * quantity
        };
        
        toast({
          title: "Item adicionado ao carrinho",
          description: `${product.name} - ${quantity}x`,
        });
        
        return [...prev, newItem];
      }
    });
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity, totalPrice: item.unitPrice * newQuantity }
        : item
    ));
  };

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
    toast({
      title: "Item removido",
      description: "Item removido do carrinho",
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotal = () => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const getItemCount = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  return {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    getTotal,
    getItemCount
  };
};
