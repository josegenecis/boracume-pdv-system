
import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDigitalMenuCart } from '@/hooks/useDigitalMenuCart';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';
import { useMenuData } from '@/hooks/useMenuData';
import { useProductVariations } from '@/hooks/useProductVariations';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuContent } from '@/components/menu/MenuContent';
import ProductVariationModal from '@/components/menu/ProductVariationModal';
import CheckoutModal from '@/components/menu/CheckoutModal';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { supabase } from '@/integrations/supabase/client';

const MenuDigital = () => {
  const { userId: paramUserId } = useParams();
  const [searchParams] = useSearchParams();
  const queryUserId = searchParams.get('u');
  
  // Usar parâmetro da URL ou query parameter
  const userId = paramUserId || queryUserId;
  
  const { toast } = useToast();
  const { sendToKitchen } = useKitchenIntegration();
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Custom hooks
  const { products, categories, loading, profile, deliveryZones } = useMenuData(userId);
  const {
    selectedProduct,
    productVariations,
    showVariationModal,
    handleProductClick,
    handleAddToCart,
    closeVariationModal
  } = useProductVariations();

  const {
    cart,
    clearCart,
    getCartTotal,
    getCartItemCount
  } = useDigitalMenuCart();

  const handlePlaceOrder = async (orderData: any) => {
    try {
      // Validar dados obrigatórios antes de enviar
      if (!orderData.user_id) {
        throw new Error('ID do usuário é obrigatório');
      }
      if (!orderData.customer_name?.trim()) {
        throw new Error('Nome do cliente é obrigatório');
      }
      if (!orderData.customer_phone?.trim()) {
        throw new Error('Telefone do cliente é obrigatório');
      }
      if (!orderData.items || orderData.items.length === 0) {
        throw new Error('Pedido deve ter pelo menos um item');
      }

      // Primeiro, verificar se o cliente já existe
      let customerId = null;
      try {
        const { data: existingCustomer, error: customerCheckError } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', orderData.user_id)
          .eq('phone', orderData.customer_phone)
          .maybeSingle();

        if (customerCheckError) {
          console.error('Erro ao verificar cliente existente:', customerCheckError);
        } else if (existingCustomer) {
          customerId = existingCustomer.id;
        }
      } catch (customerError) {
        console.error('Erro na verificação de cliente:', customerError);
      }

      if (!customerId) {
        try {
          // Criar novo cliente
          const customerData = {
            user_id: orderData.user_id,
            name: orderData.customer_name,
            phone: orderData.customer_phone,
            address: orderData.customer_address
          };

          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert([customerData])
            .select('id')
            .single();

          if (customerError) {
            console.error('Erro ao criar cliente:', customerError);
            // Continuar sem cliente se falhar - não é crítico
          } else {
            customerId = newCustomer.id;
          }
        } catch (customerError) {
          console.error('Erro na criação de cliente:', customerError);
        }
      }

      // Adicionar customer_id ao pedido se cliente foi criado/encontrado
      if (customerId) {
        orderData.customer_id = customerId;
      }

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar pedido no banco:', error);
        
        // Tratar erros específicos do banco
        if (error.code === '23505') {
          throw new Error('Número do pedido já existe. Tente novamente.');
        } else if (error.code === '23503') {
          throw new Error('Dados de referência inválidos. Verifique área de entrega.');
        } else if (error.code === '23502') {
          throw new Error('Campos obrigatórios não preenchidos.');
        } else {
          throw new Error(`Erro no banco de dados: ${error.message}`);
        }
      }

      toast({
        title: "Pedido realizado com sucesso!",
        description: `Seu pedido ${orderData.order_number} foi recebido e está sendo preparado.`,
      });

      clearCart();
      setShowCheckoutModal(false);
    } catch (error) {
      console.error('Erro completo ao finalizar pedido:', error);
      
      let userMessage = "Tente novamente ou entre em contato conosco.";
      if (error instanceof Error) {
        userMessage = error.message;
      }
      
      toast({
        title: "Erro ao finalizar pedido",
        description: userMessage,
        variant: "destructive",
      });
      
      // Re-throw para que o CheckoutModal saiba que houve erro
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
    <div className="min-h-screen bg-background">
      <MenuHeader profile={profile} />
      
      <div className="max-w-4xl mx-auto p-4 pb-24">
        <MenuContent 
          products={products}
          categories={categories}
          onProductClick={handleProductClick}
        />
      </div>

      {/* Modals */}
      <ProductVariationModal
        isOpen={showVariationModal && !!selectedProduct}
        onClose={closeVariationModal}
        product={selectedProduct || { id: '', name: '', price: 0 }}
        variations={productVariations}
        onAddToCart={handleAddToCart}
      />

      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        cart={cart}
        total={getCartTotal()}
        deliveryZones={deliveryZones}
        onPlaceOrder={handlePlaceOrder}
        userId={userId}
      />

      {/* Carrinho Fixo */}
      <CartBottomBar
        itemCount={getCartItemCount()}
        total={getCartTotal()}
        onOpenCart={() => setShowCheckoutModal(true)}
      />
    </div>
  );
};

export default MenuDigital;
