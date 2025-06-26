
import React, { useState } from 'react';
import { useMenuData } from '@/hooks/useMenuData';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { useSimpleCart } from '@/hooks/useSimpleCart';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import { SimpleCheckout } from '@/components/menu/SimpleCheckout';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { DigitalMenuHeader } from './DigitalMenuHeader';
import { DigitalMenuContent } from './DigitalMenuContent';
import { DigitalMenuErrorStates } from './DigitalMenuErrorStates';

interface DigitalMenuContainerProps {
  userId: string;
}

export const DigitalMenuContainer: React.FC<DigitalMenuContainerProps> = ({ userId }) => {
  const [showCartModal, setShowCartModal] = useState(false);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { products, categories, loading, profile, deliveryZones } = useMenuData(userId);
  const { fetchVariations } = useSimpleVariations();
  const {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartItemCount
  } = useSimpleCart();

  const handleProductClick = async (product: any) => {
    try {
      console.log('🔍 Verificando variações para produto:', product.name);
      const variations = await fetchVariations(product.id);
      
      if (variations && variations.length > 0) {
        console.log('📋 Produto tem variações, abrindo modal');
        setSelectedProduct(product);
        setShowVariationModal(true);
      } else {
        console.log('➕ Adicionando produto direto ao carrinho');
        addToCart(product);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar variações:', error);
      console.log('➕ Adicionando produto ao carrinho mesmo com erro');
      addToCart(product);
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
          console.log('➕ Adicionando ao carrinho via modal de variações');
          addToCart(product, quantity, variations, notes, variationPrice);
          setShowVariationModal(false);
          setSelectedProduct(null);
        }}
      />

      <SimpleCheckout
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
        cart={cart}
        total={getCartTotal()}
        onClearCart={clearCart}
        onRemoveFromCart={removeFromCart}
        userId={userId}
        deliveryZones={deliveryZones}
        profile={profile}
      />
    </div>
  );
};
