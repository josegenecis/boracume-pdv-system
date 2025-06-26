import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useSimpleCart } from '@/hooks/useSimpleCart';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { useMenuData } from '@/hooks/useMenuData';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuContent } from '@/components/menu/MenuContent';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import { SimpleCartModal } from '@/components/menu/SimpleCartModal';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { supabase } from '@/integrations/supabase/client';

const MenuDigital = () => {
  const { userId: paramUserId } = useParams();
  const [searchParams] = useSearchParams();
  const queryUserId = searchParams.get('u');
  
  const userId = paramUserId || queryUserId;
  
  console.log('🔄 CARDÁPIO DIGITAL - Inicializando:', {
    paramUserId,
    queryUserId,
    finalUserId: userId,
    currentUrl: window.location.href
  });
  
  const { toast } = useToast();
  const [showCartModal, setShowCartModal] = useState(false);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { products, categories, loading, profile, deliveryZones } = useMenuData(userId);
  const { fetchVariations } = useSimpleVariations();
  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartItemCount
  } = useSimpleCart();
  
  const handleProductClick = async (product: any) => {
    console.log('🔄 CARDÁPIO DIGITAL - Clique no produto:', product.name, 'ID:', product.id);
    
    try {
      const variations = await fetchVariations(product.id);
      console.log('📊 CARDÁPIO DIGITAL - Variações encontradas:', variations.length);
      
      setSelectedProduct(product);
      setShowVariationModal(true);
    } catch (error) {
      console.error('❌ CARDÁPIO DIGITAL - Erro ao buscar variações:', error);
      setSelectedProduct(product);
      setShowVariationModal(true);
    }
  };

  const handleAddToCartFromModal = (product: any, quantity: number, variations: string[], notes: string, variationPrice: number) => {
    addToCart(product, quantity, variations, notes, variationPrice);
    setShowVariationModal(false);
    setSelectedProduct(null);
  };

  const handlePlaceOrder = async (orderData: any) => {
    try {
      console.log('🔄 CHECKOUT - Iniciando processamento do pedido...');
      
      // Validações básicas
      if (!orderData.user_id || !orderData.customer_name?.trim() || !orderData.customer_phone?.trim()) {
        throw new Error('Dados obrigatórios não preenchidos');
      }
      
      if (!orderData.items || orderData.items.length === 0) {
        throw new Error('Pedido deve ter pelo menos um item');
      }

      console.log('✅ CHECKOUT - Dados validados, processando...');

      // Preparar dados finais do pedido
      const finalOrderData = {
        user_id: orderData.user_id,
        order_number: orderData.order_number,
        customer_name: orderData.customer_name.trim(),
        customer_phone: orderData.customer_phone.trim(),
        customer_address: orderData.customer_address?.trim() || '',
        customer_neighborhood: orderData.customer_neighborhood?.trim() || '',
        delivery_zone_id: orderData.delivery_zone_id || null,
        items: orderData.items,
        total: orderData.total,
        delivery_fee: orderData.delivery_fee || 0,
        payment_method: orderData.payment_method,
        change_amount: orderData.change_amount || 0,
        order_type: orderData.order_type || 'delivery',
        delivery_instructions: orderData.delivery_instructions || null,
        estimated_time: orderData.estimated_time || '30-45 min',
        status: 'pending',
        acceptance_status: 'pending_acceptance'
      };

      console.log('🔄 CHECKOUT - Criando pedido no banco de dados...');

      const { data, error } = await supabase
        .from('orders')
        .insert([finalOrderData])
        .select()
        .single();

      if (error) {
        console.error('❌ CHECKOUT - Erro ao criar pedido:', error);
        throw new Error(`Erro ao criar pedido: ${error.message}`);
      }

      console.log('✅ CHECKOUT - Pedido criado com sucesso:', data);

      toast({
        title: "Pedido realizado com sucesso!",
        description: `Seu pedido ${finalOrderData.order_number} foi recebido e está sendo preparado.`,
      });

      clearCart();
      setShowCartModal(false);
    } catch (error) {
      console.error('❌ CHECKOUT - Erro completo:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao processar pedido";
      
      toast({
        title: "Erro ao finalizar pedido",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Link inválido</h1>
          <p className="text-muted-foreground">Verifique se o link está correto.</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Restaurante não encontrado</h1>
          <p className="text-muted-foreground">Este restaurante pode não existir ou estar temporariamente indisponível.</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{profile?.restaurant_name || 'Restaurante'}</h1>
          <p className="text-muted-foreground">Este restaurante ainda não possui produtos disponíveis para delivery.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <MenuHeader profile={profile} />
      
      <div className="max-w-4xl mx-auto p-4 pb-24">
        <MenuContent 
          products={products}
          categories={categories}
          onProductClick={handleProductClick}
        />
      </div>

      <SimpleVariationModal
        isOpen={showVariationModal}
        onClose={() => {
          setShowVariationModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onAddToCart={handleAddToCartFromModal}
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

      <CartBottomBar
        itemCount={getCartItemCount()}
        total={getCartTotal()}
        onOpenCart={() => setShowCartModal(true)}
      />
    </div>
  );
};

export default MenuDigital;
