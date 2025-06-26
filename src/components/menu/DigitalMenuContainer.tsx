
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDigitalCart } from '@/hooks/useDigitalCart';
import { useMenuData } from '@/hooks/useMenuData';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import SimpleCartModal from '@/components/menu/SimpleCartModal';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { DigitalMenuHeader } from './DigitalMenuHeader';
import { DigitalMenuContent } from './DigitalMenuContent';
import { DigitalMenuErrorStates } from './DigitalMenuErrorStates';

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
}

interface DigitalMenuContainerProps {
  userId: string;
}

export const DigitalMenuContainer: React.FC<DigitalMenuContainerProps> = ({ userId }) => {
  const [showCartModal, setShowCartModal] = useState(false);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  const { products, categories, loading, profile } = useMenuData(userId);
  const { fetchVariations } = useSimpleVariations();
  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartItemCount
  } = useDigitalCart();

  useEffect(() => {
    if (userId) {
      loadDeliveryZones();
    }
  }, [userId]);

  const loadDeliveryZones = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('Erro ao carregar zonas de entrega:', error);
        return;
      }

      setDeliveryZones(data || []);
    } catch (error) {
      console.error('Erro ao carregar zonas de entrega:', error);
    }
  };

  const handleProductClick = async (product: any) => {
    try {
      const variations = await fetchVariations(product.id);
      
      if (variations && variations.length > 0) {
        setSelectedProduct(product);
        setShowVariationModal(true);
      } else {
        addToCart(product);
      }
    } catch (error) {
      console.error('Erro ao buscar variações:', error);
      addToCart(product);
    }
  };

  const handlePlaceOrder = async (orderData: any) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao finalizar pedido: ${error.message}`);
      }

      clearCart();
      setShowCartModal(false);
      
    } catch (error) {
      console.error('Erro na finalização:', error);
      throw error;
    }
  };

  if (loading) {
    return <DigitalMenuErrorStates type="loading" />;
  }

  if (!profile) {
    return <DigitalMenuErrorStates type="no-profile" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DigitalMenuHeader profile={profile} />

      <div className="max-w-4xl mx-auto p-4 pb-24">
        <DigitalMenuContent
          products={products}
          categories={categories}
          onProductClick={handleProductClick}
        />
      </div>

      <CartBottomBar
        itemCount={getCartItemCount()}
        total={getCartTotal()}
        onOpenCart={() => setShowCartModal(true)}
      />

      <SimpleVariationModal
        isOpen={showVariationModal}
        onClose={() => {
          setShowVariationModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onAddToCart={(product, quantity, variations, notes, variationPrice) => {
          addToCart(product, quantity, variations, notes, variationPrice);
          setShowVariationModal(false);
          setSelectedProduct(null);
        }}
      />

      <SimpleCartModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
        cart={cart}
        total={getCartTotal()}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onPlaceOrder={handlePlaceOrder}
        deliveryZones={deliveryZones}
        userId={userId}
      />
    </div>
  );
};
