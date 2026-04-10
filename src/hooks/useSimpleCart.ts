import { useEffect, useMemo, useRef, useState } from 'react';
import { perfStart } from '@/utils/perf';

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

const MENU_CART_STORAGE_PREFIX = 'boracume_menu_cart';
const LEGACY_MENU_CART_STORAGE_KEY = 'boracume_menu_cart';

const readCartFromStorage = (storageKey: string) => {
  try {
    const scoped = localStorage.getItem(storageKey);
    if (scoped) return JSON.parse(scoped);
    if (storageKey !== LEGACY_MENU_CART_STORAGE_KEY) {
      const legacy = localStorage.getItem(LEGACY_MENU_CART_STORAGE_KEY);
      if (legacy) return JSON.parse(legacy);
    }
  } catch {}
  return [];
};

export const getMenuCartStorageKey = (scope?: string) => {
  const normalizedScope = String(scope || '').trim();
  return normalizedScope ? `${MENU_CART_STORAGE_PREFIX}:${normalizedScope}` : LEGACY_MENU_CART_STORAGE_KEY;
};

export const clearMenuCartStorage = (scope?: string) => {
  try {
    const storageKey = getMenuCartStorageKey(scope);
    localStorage.removeItem(storageKey);
    if (storageKey !== LEGACY_MENU_CART_STORAGE_KEY) {
      localStorage.removeItem(LEGACY_MENU_CART_STORAGE_KEY);
    }
  } catch {}
};

export const clearAllMenuCartStorage = () => {
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (key === LEGACY_MENU_CART_STORAGE_KEY || key.startsWith(`${MENU_CART_STORAGE_PREFIX}:`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {}
};

export const useSimpleCart = (scope?: string) => {
  const storageKey = useMemo(() => getMenuCartStorageKey(scope), [scope]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    return readCartFromStorage(storageKey);
  });
  
  const persistTimerRef = useRef<number | null>(null);
  const pendingPerfRef = useRef<{ start: ReturnType<typeof perfStart> } | null>(null);

  useEffect(() => {
    setCart(readCartFromStorage(storageKey));
  }, [storageKey]);

  // Persistir carrinho
  useEffect(() => {
    try {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(() => {
        try {
          const payload = JSON.stringify(cart);
          const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: any) => number);
          if (idle) {
            idle(() => {
              try {
                localStorage.setItem(storageKey, payload);
                if (storageKey !== LEGACY_MENU_CART_STORAGE_KEY) {
                  localStorage.removeItem(LEGACY_MENU_CART_STORAGE_KEY);
                }
              } catch {}
            }, { timeout: 500 });
          } else {
            localStorage.setItem(storageKey, payload);
            if (storageKey !== LEGACY_MENU_CART_STORAGE_KEY) {
              localStorage.removeItem(LEGACY_MENU_CART_STORAGE_KEY);
            }
          }
        } catch {}
      }, 120);
    } catch {}
  }, [cart, storageKey]);

  useEffect(() => {
    if (pendingPerfRef.current) {
      pendingPerfRef.current.start.end({ cartItems: cart.length });
      pendingPerfRef.current = null;
    }
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (Number(item.totalPrice) || 0), 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  }, [cart]);

  const addToCart = (
    product: CartProduct, 
    quantity: number = 1, 
    variations: string[] = [], 
    notes: string = '',
    variationPrice: number = 0
  ) => {
    pendingPerfRef.current = { start: perfStart('menu.cart.add', { productId: product.id, qty: quantity }) };

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
  };

  const clearCart = () => {
    try {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    } catch {}
    clearMenuCartStorage(scope);
    setCart([]);
  };

  const getCartTotal = () => {
    return cartTotal;
  };

  const getCartItemCount = () => {
    return cartItemCount;
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
