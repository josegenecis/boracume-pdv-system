
import React, { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useSimpleCart } from '@/hooks/useSimpleCart';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { useMenuData } from '@/hooks/useMenuData';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuContent } from '@/components/menu/MenuContent';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import { SimpleCartModal } from '@/components/menu/SimpleCartModal';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { supabase } from '@/integrations/supabase/client';
import PixPaymentModal from '@/components/payment/PixPaymentModal';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
}

const MenuDigital = () => {
  const { userId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const userIdFromQuery = queryParams.get('userId');
  const { user } = useAuth();
  
  const finalUserId = userId || userIdFromQuery || user?.id || '';
  
  console.log('🔍 MenuDigital - Iniciando com userId:', finalUserId);
  console.log('🔍 MenuDigital - URL atual:', window.location.href);
  console.log('🔍 MenuDigital - Params:', { userId, userIdFromQuery });

  const { 
    products, 
    categories, 
    profile, 
    deliveryZones, 
    isLoading: menuLoading 
  } = useMenuData(finalUserId);

  console.log('🔍 MenuDigital - Estado do loading:', menuLoading);
  console.log('🔍 MenuDigital - Dados carregados:', { 
    products: products?.length, 
    categories: categories?.length, 
    profile: !!profile,
    deliveryZones: deliveryZones?.length 
  });

  const { toast } = useToast();
  const { 
    cart, 
    addToCart, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    getCartTotal, 
    getCartItemCount 
  } = useSimpleCart();

  const { fetchVariations } = useSimpleVariations();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const navigate = useNavigate();
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixAmount, setPixAmount] = useState(0);
  const [pixOrderId, setPixOrderId] = useState<string | undefined>(undefined);

  const debugInfo = {
    expectedUrl: `${window.location.origin}/menu/{userId}`,
    isCorrectUrl: window.location.pathname.includes('/menu/')
  };

  if (!window.location.pathname.includes('/menu/')) {
    console.log('⚠️ URL incorreta detectada:', debugInfo);
    console.warn('⚠️ Para testar variações, acesse: /menu/{userId}');
  }

  const handleProductClick = async (product: Product) => {
    console.log('🔍 MenuDigital - Produto clicado:', product.name);
    
    if (!finalUserId) {
      console.error('❌ MenuDigital - userId não encontrado');
      return;
    }

    try {
      console.log('🔄 MenuDigital - Buscando variações...');
      const variations = await fetchVariations(product.id);
      
      console.log('📊 MenuDigital - Resultado busca variações:', {
        total: variations.length,
        variações: variations.map((v: any) => v.name)
      });
      
      // SEMPRE abrir modal de variações, mesmo se não houver variações
      console.log('✅ MenuDigital - Abrindo modal de variações/detalhes...');
      
      setSelectedProduct(product);
      setShowVariationModal(true);
      
      console.log('🔧 MenuDigital - Estados definidos:', {
        selectedProduct: product.name,
        variationsCount: variations.length,
        modalAberto: true
      });
    } catch (error) {
      console.error('❌ MenuDigital - Erro ao buscar variações:', error);
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
            address: orderData.customer_address,
            neighborhood: orderData.customer_neighborhood || ''
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

      // Notificar cliente via WhatsApp (pedido recebido)
      try {
        if (orderData.customer_phone && data?.id) {
          const trackUrl = `${window.location.origin}/track/${data.id}`;
          await supabase.functions.invoke('whatsapp-notify', {
            body: {
              to: orderData.customer_phone,
              text: `Recebemos seu pedido ${orderData.order_number}. Acompanhe aqui: ${trackUrl}`
            }
          });
        }
      } catch (waErr) {
        console.warn('⚠️ Falha ao notificar via WhatsApp (não crítico):', waErr);
      }

      if (orderData.payment_method === 'pix') {
        setPixAmount(orderData.total);
        setPixOrderId(data?.id);
        setShowPixModal(true);
        toast({
          title: "Pedido criado!",
          description: "Aguardando pagamento do PIX para enviar ao restaurante.",
        });
      } else {
      toast({
        title: "Pedido realizado!",
        description: `Acompanhe o andamento do pedido ${orderData.order_number}.`,
      });
      clearCart();
      setShowCartModal(false);
      if (data?.id) {
        navigate(`/track/${data.id}`);
      }
      }
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

  if (menuLoading) {
    console.log('🔄 MenuDigital - Ainda carregando dados...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Carregando cardápio...</p>
          <p className="text-sm text-muted-foreground">userId: {finalUserId}</p>
        </div>
      </div>
    );
  }

  if (!finalUserId) {
    console.log('❌ MenuDigital - userId não encontrado');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Link inválido</h1>
          <p className="text-muted-foreground">Verifique se o link está correto.</p>
          <p className="text-sm text-gray-500 mt-2">URL: {window.location.href}</p>
        </div>
      </div>
    );
  }

  if (!profile && products.length === 0) {
    console.log('❌ MenuDigital - Profile não encontrado e sem produtos para userId:', finalUserId);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Cardápio não encontrado</h1>
          <p className="text-muted-foreground">Este restaurante pode não existir ou estar temporariamente indisponível.</p>
          <p className="text-sm text-gray-500 mt-2">userId: {finalUserId}</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    console.log('⚠️ MenuDigital - Nenhum produto encontrado para userId:', finalUserId);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{profile?.restaurant_name || 'Restaurante'}</h1>
          <p className="text-muted-foreground">Este restaurante ainda não possui produtos disponíveis para delivery.</p>
        </div>
      </div>
    );
  }

  console.log('✅ MenuDigital - Renderizando cardápio com sucesso');

  return (
    <div className="min-h-screen bg-white">
      <MenuHeader profile={profile || { restaurant_name: 'Restaurante' }} />
      
      <div className="max-w-4xl mx-auto p-4 pb-24">
        {(() => {
          const categoryNames = categories.map((c: any) => c.name);
          const productsWithCategory = products.map((p: any) => ({
            ...p,
            category: (categories.find((c: any) => c.id === p.category_id)?.name) || 'Outros'
          }));

          return (
            <MenuContent 
              products={productsWithCategory}
              categories={categoryNames}
              onProductClick={handleProductClick}
            />
          );
        })()}
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

      <SimpleCartModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
        cart={cart}
        total={getCartTotal()}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onPlaceOrder={handlePlaceOrder}
        deliveryZones={deliveryZones}
        userId={finalUserId}
      />

      <PixPaymentModal
        isOpen={showPixModal}
        onClose={() => setShowPixModal(false)}
        amount={pixAmount}
        orderId={pixOrderId}
        onPaymentConfirmed={async () => {
          if (!pixOrderId) return;
          try {
            const { error: updateError } = await supabase
              .from('orders')
              .update({ acceptance_status: 'pending_acceptance' })
              .eq('id', pixOrderId);
            if (!updateError) {
              toast({
                title: "Pagamento confirmado!",
                description: "Seu pedido foi enviado para o restaurante.",
              });
              clearCart();
              setShowCartModal(false);
              navigate(`/track/${pixOrderId}`);
            }
          } catch (e) {
            console.error(e);
          }
        }}
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
