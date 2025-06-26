
import React, { useState } from 'react';
import { useMenuData } from '@/hooks/useMenuData';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { useDigitalCart } from '@/hooks/useDigitalCart';
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

  const { products, categories, loading, profile } = useMenuData(userId);
  const { fetchVariations } = useSimpleVariations();
  const {
    cart,
    addToCart,
    clearCart,
    getCartTotal,
    getCartItemCount
  } = useDigitalCart();

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

      <SimpleCheckout
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
        cart={cart}
        total={getCartTotal()}
        onClearCart={clearCart}
        userId={userId}
      />
    </div>
  );
};
