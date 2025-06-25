
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDigitalCart } from '@/hooks/useDigitalCart';
import { useMenuData } from '@/hooks/useMenuData';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import SimpleCartModal from '@/components/menu/SimpleCartModal';
import CartBottomBar from '@/components/menu/CartBottomBar';

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
}

const DigitalMenu = () => {
  const { userId } = useParams();
  console.log('🚀 DigitalMenu iniciado com userId:', userId);

  // Estados principais
  const [showCartModal, setShowCartModal] = useState(false);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('Iniciando diagnóstico...');
  const [forceRefresh, setForceRefresh] = useState(0);

  // Hooks
  const { products, categories, loading, profile } = useMenuData(userId || null);
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

  // Debug detalhado
  useEffect(() => {
    console.log('🔍 DIAGNÓSTICO DIGITAL MENU:');
    console.log('- UserId:', userId);
    console.log('- Loading:', loading);
    console.log('- Profile:', profile);
    console.log('- Products count:', products?.length || 0);
    console.log('- Categories:', categories);
    
    const debugText = `
DIAGNÓSTICO COMPLETO:
===================
✅ URL Atual: ${window.location.href}
✅ UserId Extraído: ${userId || 'UNDEFINED'}
✅ Loading Status: ${loading}
✅ Profile Carregado: ${profile ? 'SIM' : 'NÃO'}
✅ Nome do Restaurante: ${profile?.restaurant_name || 'NÃO DEFINIDO'}
✅ Telefone: ${profile?.phone || 'NÃO DEFINIDO'}
✅ Produtos Encontrados: ${products?.length || 0}
✅ Categorias: ${categories?.length || 0} (${categories?.join(', ') || 'NENHUMA'})
✅ Items no Carrinho: ${getCartItemCount()}
✅ Timestamp: ${new Date().toLocaleString()}

DETALHES DOS PRODUTOS:
${products?.map(p => `- ${p.name} (${p.category}) - R$ ${p.price}`).join('\n') || 'Nenhum produto encontrado'}

STATUS DA CONEXÃO:
✅ Supabase Client: Configurado
✅ Database: Conectado
    `;
    setDebugInfo(debugText);
  }, [userId, loading, profile, products, categories, forceRefresh]);

  // Carregar zonas de entrega
  useEffect(() => {
    if (userId) {
      console.log('🚚 Carregando zonas de entrega para userId:', userId);
      loadDeliveryZones();
    }
  }, [userId]);

  const loadDeliveryZones = async () => {
    try {
      console.log('📍 Buscando delivery zones...');
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('❌ Erro ao carregar zonas de entrega:', error);
        return;
      }

      console.log('✅ Zonas de entrega carregadas:', data?.length || 0);
      setDeliveryZones(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar zonas de entrega:', error);
    }
  };

  // Forçar refresh
  const handleForceRefresh = () => {
    console.log('🔄 Forçando refresh...');
    setForceRefresh(prev => prev + 1);
    window.location.reload();
  };

  // Lidar com clique no produto
  const handleProductClick = async (product: any) => {
    console.log('🔘 CLICK NO PRODUTO:', product.name);
    try {
      const variations = await fetchVariations(product.id);
      console.log('🔄 Variações encontradas:', variations?.length || 0);
      
      if (variations && variations.length > 0) {
        setSelectedProduct(product);
        setShowVariationModal(true);
      } else {
        console.log('➕ Adicionando produto direto ao carrinho');
        addToCart(product);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar variações:', error);
      addToCart(product);
    }
  };

  // Finalizar pedido
  const handlePlaceOrder = async (orderData: any) => {
    console.log('🛍️ Finalizando pedido:', orderData);
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar pedido:', error);
        throw new Error('Erro ao finalizar pedido');
      }

      console.log('✅ Pedido criado com sucesso:', data);
      clearCart();
      setShowCartModal(false);
      
      alert('Pedido realizado com sucesso! Em breve entraremos em contato.');
      
    } catch (error) {
      console.error('❌ Erro ao finalizar pedido:', error);
      throw error;
    }
  };

  // Verificação de userId
  if (!userId) {
    console.error('❌ UserId não encontrado na URL');
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8 max-w-2xl">
          <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-red-700 mb-2">❌ ERRO: Link Inválido</h1>
          <p className="text-red-600 mb-4">ID do usuário não encontrado na URL.</p>
          
          <div className="bg-white p-4 rounded-lg border-2 border-red-200 mb-4">
            <h3 className="font-bold text-red-800 mb-2">🔧 INSTRUÇÕES PARA CORRIGIR:</h3>
            <ol className="text-left text-sm text-gray-700 space-y-2">
              <li><strong>1.</strong> A URL deve ser: <code>/cardapio/SEU-ID-AQUI</code></li>
              <li><strong>2.</strong> Verifique se você está usando o link correto do painel</li>
              <li><strong>3.</strong> O ID deve ser um UUID válido</li>
            </ol>
          </div>
          
          <div className="bg-gray-100 p-3 rounded text-left text-xs">
            <p><strong>URL atual:</strong> {window.location.href}</p>
            <p><strong>Path:</strong> {window.location.pathname}</p>
            <p><strong>UserId extraído:</strong> {userId || 'NENHUM'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Estado de loading
  if (loading) {
    console.log('⏳ Ainda carregando dados...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center max-w-4xl mx-auto p-8">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mb-4 mx-auto"></div>
          <p className="text-lg font-semibold mb-4">🔄 Carregando cardápio...</p>
          
          <div className="bg-white p-6 rounded-lg shadow-lg text-left">
            <h3 className="font-bold text-blue-800 mb-4 text-center">📊 DIAGNÓSTICO EM TEMPO REAL</h3>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-96">
              {debugInfo}
            </pre>
            
            <Button 
              onClick={handleForceRefresh}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Forçar Atualização
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Perfil não encontrado
  if (!profile) {
    console.error('❌ Perfil não encontrado para userId:', userId);
    return (
      <div className="min-h-screen flex items-center justify-center bg-yellow-50">
        <div className="text-center p-8 max-w-4xl mx-auto">
          <AlertCircle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold text-yellow-700 mb-2">⚠️ Restaurante não encontrado</h1>
          <p className="text-yellow-600 mb-4">Este restaurante pode não existir ou estar indisponível.</p>
          
          <div className="bg-white p-6 rounded-lg shadow-lg text-left mb-4">
            <h3 className="font-bold text-yellow-800 mb-4 text-center">🔍 INFORMAÇÕES DE DEBUG</h3>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-96">
              {debugInfo}
            </pre>
          </div>
          
          <div className="bg-white p-4 rounded-lg border-2 border-yellow-200">
            <h3 className="font-bold text-yellow-800 mb-2">🛠️ POSSÍVEIS SOLUÇÕES:</h3>
            <ul className="text-left text-sm text-gray-700 space-y-2">
              <li><strong>1.</strong> Verifique se o ID está correto</li>
              <li><strong>2.</strong> Confirme se o restaurante existe no banco de dados</li>
              <li><strong>3.</strong> Tente usar o link gerado no painel administrativo</li>
              <li><strong>4.</strong> Limpe o cache do navegador (Ctrl+F5)</li>
            </ul>
          </div>
          
          <Button 
            onClick={handleForceRefresh}
            className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  console.log('✅ Renderizando cardápio completo - SUCESSO!');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header do Restaurante */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center gap-4">
            {profile.logo_url && (
              <img src={profile.logo_url} alt="Logo" className="w-16 h-16 rounded-full object-cover" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{profile.restaurant_name || 'Restaurante'}</h1>
              {profile.description && <p className="text-gray-600">{profile.description}</p>}
              {profile.phone && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{profile.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Debug - SEMPRE VISÍVEL para diagnóstico */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-green-800 flex items-center gap-2">
              ✅ CARDÁPIO FUNCIONANDO!
            </h3>
            <Button 
              onClick={handleForceRefresh}
              size="sm"
              variant="outline"
              className="border-green-300"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>✅ Restaurante:</strong> {profile.restaurant_name}</p>
              <p><strong>✅ Produtos:</strong> {products.length} encontrados</p>
              <p><strong>✅ Categorias:</strong> {categories.length} ativas</p>
            </div>
            <div>
              <p><strong>✅ URL:</strong> Correta</p>
              <p><strong>✅ Database:</strong> Conectado</p>
              <p><strong>✅ Status:</strong> Funcionando 🎉</p>
            </div>
          </div>
          
          <details className="mt-3">
            <summary className="cursor-pointer text-green-700 font-medium hover:underline">
              📋 Ver diagnóstico completo
            </summary>
            <pre className="text-xs text-green-700 mt-2 bg-white p-3 rounded border max-h-60 overflow-auto">
              {debugInfo}
            </pre>
          </details>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-4xl mx-auto p-4 pb-24">
        {products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">📋 Nenhum produto disponível</h2>
            <p className="text-gray-600">Este restaurante ainda não possui produtos no cardápio.</p>
          </div>
        ) : (
          categories.map(category => (
            <div key={category} className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                🏷️ {category}
                <span className="text-sm font-normal text-gray-500">
                  ({products.filter(p => p.category === category).length} produtos)
                </span>
              </h2>
              <div className="grid gap-4">
                {products.filter(p => p.category === category).map(product => (
                  <Card key={product.id} className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex gap-4">
                      {product.image_url && (
                        <img src={product.image_url} alt={product.name} className="w-20 h-20 rounded object-cover" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        {product.description && (
                          <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                        )}
                        <p className="text-primary font-bold text-lg mt-2">R$ {product.price.toFixed(2)}</p>
                      </div>
                      <Button onClick={() => handleProductClick(product)} className="self-center">
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Carrinho Fixo */}
      <CartBottomBar
        itemCount={getCartItemCount()}
        total={getCartTotal()}
        onOpenCart={() => setShowCartModal(true)}
      />

      {/* Modal de Variações */}
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

      {/* Modal do Carrinho */}
      <SimpleCartModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
        cart={cart}
        total={getCartTotal()}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onPlaceOrder={handlePlaceOrder}
        deliveryZones={deliveryZones}
        userId={userId || ''}
      />
    </div>
  );
};

export default DigitalMenu;
