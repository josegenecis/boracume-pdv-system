import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useSimpleCart } from '@/hooks/useSimpleCart';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { useMenuData } from '@/hooks/useMenuData';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuContent } from '@/components/menu/MenuContent';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import CheckoutModal from '@/components/menu/CheckoutModal';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { supabase } from '@/integrations/supabase/client';

const MenuDigital = () => {
  const { userId: paramUserId } = useParams();
  const [searchParams] = useSearchParams();
  const queryUserId = searchParams.get('u');
  
  // Usar parâmetro da URL ou query parameter
  const userId = paramUserId || queryUserId;
  
  console.log('🚀 CARDÁPIO DIGITAL - INICIADO:', {
    paramUserId,
    queryUserId,
    finalUserId: userId,
    currentUrl: window.location.href,
    expectedUrl: `${window.location.origin}/menu/{userId}`,
    isCorrectUrl: window.location.pathname.includes('/menu/')
  });

  if (!window.location.pathname.includes('/menu/')) {
    console.warn('⚠️ CARDÁPIO DIGITAL - VOCÊ ESTÁ NA URL ERRADA!');
    console.warn('⚠️ Para testar variações, acesse: /menu/{userId}');
    console.warn('⚠️ Não teste na área administrativa!');
  }
  
  const { toast } = useToast();
  const [showCartModal, setShowCartModal] = useState(false);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Custom hooks
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
    console.log('🚀 CARDÁPIO DIGITAL - CLICK NO PRODUTO:', product.name, 'ID:', product.id);
    
    try {
      console.log('🔄 CARDÁPIO DIGITAL - Buscando variações...');
      const variations = await fetchVariations(product.id);
      
      console.log('📊 CARDÁPIO DIGITAL - Resultado busca variações:', {
        total: variations.length,
        variações: variations.map(v => v.name)
      });
      
      // SEMPRE abrir modal de variações, mesmo se não houver variações
      // Isso permite que o usuário ajuste quantidade e adicione observações
      console.log('✅ CARDÁPIO DIGITAL - Abrindo modal de variações/detalhes...');
      
      setSelectedProduct(product);
      setShowVariationModal(true);
      
      console.log('🔧 CARDÁPIO DIGITAL - Estados definidos:', {
        selectedProduct: product.name,
        variationsCount: variations.length,
        modalAberto: true
      });
    } catch (error) {
      console.error('❌ CARDÁPIO DIGITAL - Erro ao buscar variações:', error);
      // Em caso de erro, ainda assim abrir o modal para permitir adicionar quantidade
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
      console.log('🚀 Iniciando finalização do pedido:', orderData);

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

      // Converter itens do carrinho para o formato esperado pelo banco
      const formattedItems = cart.map(item => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        variations: item.variations || [],
        notes: item.notes || '',
        subtotal: item.totalPrice
      }));

      if (formattedItems.length === 0) {
        throw new Error('Pedido deve ter pelo menos um item');
      }

      // Gerar número do pedido
      const orderNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

      // Preparar dados do pedido para o banco (removendo campos problemáticos)
      const finalOrderData = {
        user_id: userId,
        customer_name: orderData.customer_name.trim(),
        customer_phone: orderData.customer_phone.trim(),
        customer_address: orderData.delivery_type === 'delivery' ? orderData.customer_address?.trim() || '' : 'Retirada no Local',
        delivery_type: orderData.delivery_type || 'delivery',
        payment_method: orderData.payment_method || 'cash',
        notes: orderData.notes?.trim() || '',
        items: formattedItems,
        total: getCartTotal(),
        delivery_fee: orderData.delivery_type === 'delivery' ? (orderData.delivery_fee || 0) : 0,
        delivery_zone_id: orderData.delivery_type === 'delivery' ? orderData.delivery_zone_id : null,
        status: 'pending',
        order_number: orderNumber,
        order_type: 'delivery'
      };

      console.log('📝 Dados finais do pedido:', finalOrderData);

      // Primeiro, verificar se o cliente já existe
      let customerId = null;
      try {
        const { data: existingCustomer, error: customerCheckError } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', userId)
          .eq('phone', finalOrderData.customer_phone)
          .maybeSingle();

        if (customerCheckError) {
          console.error('Erro ao verificar cliente existente:', customerCheckError);
        } else if (existingCustomer) {
          customerId = existingCustomer.id;
          console.log('✅ Cliente existente encontrado:', customerId);
        }
      } catch (customerError) {
        console.error('Erro na verificação de cliente:', customerError);
      }

      if (!customerId) {
        try {
          // Criar novo cliente
          const customerData = {
            user_id: userId,
            name: finalOrderData.customer_name,
            phone: finalOrderData.customer_phone,
            address: finalOrderData.customer_address,
            neighborhood: ''
          };

          console.log('👤 Criando novo cliente:', customerData);

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
            console.log('✅ Novo cliente criado:', customerId);
          }
        } catch (customerError) {
          console.error('Erro na criação de cliente:', customerError);
        }
      }

      console.log('💾 Salvando pedido no banco...');

      const { data, error } = await supabase
        .from('orders')
        .insert([finalOrderData])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar pedido no banco:', error);
        
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

      console.log('✅ Pedido criado com sucesso:', data);

      toast({
        title: "Pedido realizado com sucesso!",
        description: `Seu pedido #${orderNumber} foi recebido e está sendo preparado.`,
      });

      clearCart();
      setShowCartModal(false);
    } catch (error) {
      console.error('❌ Erro completo ao finalizar pedido:', error);
      
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
    <div className="min-h-screen bg-white">
      <MenuHeader profile={profile} />
      
      <div className="max-w-4xl mx-auto p-4 pb-24">
        <MenuContent 
          products={products}
          categories={categories}
          onProductClick={handleProductClick}
        />
      </div>

      {/* Modals */}
      <SimpleVariationModal
        isOpen={showVariationModal}
        onClose={() => {
          setShowVariationModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onAddToCart={handleAddToCartFromModal}
      />

      <CheckoutModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
        cartItems={cart}
        total={getCartTotal()}
        onOrderSubmit={handlePlaceOrder}
        userId={userId}
      />

      {/* Carrinho Fixo */}
      <CartBottomBar
        itemCount={getCartItemCount()}
        total={getCartTotal()}
        onOpenCart={() => setShowCartModal(true)}
      />
    </div>
  );
};

export default MenuDigital;
