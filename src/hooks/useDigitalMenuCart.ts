
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
    console.log('🔄 CARDÁPIO DIGITAL - INICIANDO ADIÇÃO AO CARRINHO:', {
      product: product.name,
      productId: product.id,
      quantity,
      selectedVariations,
      notes,
      currentCartSize: cart.length
    });

    // Extrair opções selecionadas e calcular preço das variações
<<<<<<< HEAD
    let selectedOptions: string[] = [];
=======
    const selectedOptions: string[] = [];
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    let variationPrice = 0;

    if (Array.isArray(selectedVariations)) {
      selectedVariations.forEach(variation => {
        if (variation && Array.isArray(variation.options)) {
          variation.options.forEach((option: any) => {
            if (option && option.name) {
              selectedOptions.push(String(option.name));
              const price = Number(option.price);
              if (!isNaN(price)) {
                variationPrice += price;
              }
            }
          });
        }
      });
    }
<<<<<<< HEAD
    // Remover duplicatas
    selectedOptions = Array.from(new Set(selectedOptions));
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    
    const basePrice = Number(product.price) || 0;
    const itemPrice = basePrice + variationPrice;
    const subtotal = itemPrice * quantity;
    
    console.log('💰 Cálculo de preços:', {
      basePrice,
      variationPrice,
      itemPrice,
      quantity,
      subtotal
    });
    
    const newItem: CartItem = {
      ...product,
      quantity,
      selectedOptions,
      notes: notes.trim(),
      subtotal,
      variationPrice
    };

    setCart(prev => {
      console.log('🔄 CARRINHO - Estado atual antes da adição:', {
        itemsAtuais: prev.length,
        itens: prev.map(item => ({ name: item.name, qty: item.quantity }))
      });

      // Verificar se já existe um item idêntico
      const existingIndex = prev.findIndex(item => 
        item.id === product.id &&
        JSON.stringify(item.selectedOptions?.sort()) === JSON.stringify(selectedOptions.sort()) &&
        item.notes === notes.trim()
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        updated[existingIndex].subtotal = (updated[existingIndex].price + updated[existingIndex].variationPrice) * updated[existingIndex].quantity;
        console.log('✅ CARRINHO - Item existente atualizado:', {
          produto: updated[existingIndex].name,
          novaQuantidade: updated[existingIndex].quantity,
          novoSubtotal: updated[existingIndex].subtotal
        });
        return updated;
      }

      const newCart = [...prev, newItem];
      console.log('✅ CARRINHO - Novo item adicionado:', {
        produto: newItem.name,
        quantidade: newItem.quantity,
        subtotal: newItem.subtotal,
        novoTamanhoCarrinho: newCart.length
      });
      return newCart;
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
      if (item) {
        const basePrice = Number(item.price) || 0;
        const variationPrice = Number(item.variationPrice) || 0;
        updated[index] = {
          ...item,
          quantity,
          subtotal: (basePrice + variationPrice) * quantity
        };
      }
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    toast({
      title: "Item removido",
      description: "O item foi removido do carrinho.",
    });
  };

  const clearCart = () => {
    setCart([]);
    console.log('🗑️ Carrinho limpo');
  };

  const getCartTotal = () => {
    const total = cart.reduce((sum, item) => {
      const subtotal = Number(item.subtotal) || 0;
      return sum + subtotal;
    }, 0);
    console.log('💰 Total do carrinho:', total);
    return total;
  };

  const getCartItemCount = () => {
    const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    console.log('📦 Itens no carrinho:', count);
    return count;
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
