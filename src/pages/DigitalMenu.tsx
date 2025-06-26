
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDigitalCart } from '@/hooks/useDigitalCart';
import { useMenuData } from '@/hooks/useMenuData';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone, Plus, AlertCircle } from 'lucide-react';
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

  const [showCartModal, setShowCartModal] = useState(false);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

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

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8 max-w-2xl">
          <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-red-700 mb-2">Erro: Link Inválido</h1>
          <p className="text-red-600 mb-4">ID do usuário não encontrado na URL.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center max-w-4xl mx-auto p-8">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mb-4 mx-auto"></div>
          <p className="text-lg font-semibold mb-4">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-yellow-50">
        <div className="text-center p-8 max-w-4xl mx-auto">
          <AlertCircle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold text-yellow-700 mb-2">Restaurante não encontrado</h1>
          <p className="text-yellow-600 mb-4">Este restaurante pode não existir ou estar indisponível.</p>
        </div>
      </div>
    );
  }

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

      {/* Conteúdo Principal */}
      <div className="max-w-4xl mx-auto p-4 pb-24">
        {products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">Nenhum produto disponível</h2>
            <p className="text-gray-600">Este restaurante ainda não possui produtos no cardápio.</p>
          </div>
        ) : (
          categories.map(category => (
            <div key={category} className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                {category}
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
