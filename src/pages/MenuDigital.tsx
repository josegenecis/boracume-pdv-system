
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Search, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { useDigitalMenuCart } from '@/hooks/useDigitalMenuCart';
import ProductVariationModal from '@/components/menu/ProductVariationModal';
import CheckoutModal from '@/components/menu/CheckoutModal';
import WhatsAppButton from '@/components/chat/WhatsAppButton';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
}

interface ProductVariation {
  id: string;
  name: string;
  options: Array<{
    name: string;
    price: number;
  }>;
  max_selections: number;
  required: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface Profile {
  restaurant_name?: string;
  phone?: string;
  address?: string;
  description?: string;
  logo_url?: string;
}

const MenuDigital: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariations, setProductVariations] = useState<ProductVariation[]>([]);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const {
    cart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartItemCount
  } = useDigitalMenuCart();

  useEffect(() => {
    if (userId) {
      fetchMenuData();
    }
  }, [userId]);

  const fetchMenuData = async () => {
    if (!userId) return;

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('restaurant_name, phone, address, description, logo_url')
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('user_id', userId)
        .eq('active', true)
        .order('display_order');

      if (categoriesData) {
        setCategories(categoriesData);
      }

      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('show_in_delivery', true)
        .eq('available', true)
        .order('name');

      if (productsData) {
        setProducts(productsData);
      }
    } catch (error) {
      console.error('Erro ao carregar menu:', error);
    }
  };

  const fetchProductVariations = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao carregar variações:', error);
      return [];
    }
  };

  const handleProductClick = async (product: Product) => {
    const variations = await fetchProductVariations(product.id);
    
    if (variations.length > 0) {
      setSelectedProduct(product);
      setProductVariations(variations);
      setShowVariationModal(true);
    } else {
      addToCart(product, 1, [], '');
    }
  };

  const handlePlaceOrder = async (orderData: any) => {
    try {
      // Calculate order number
      const orderNumber = `WEB-${Date.now()}`;
      
      const { error } = await supabase
        .from('orders')
        .insert([{
          user_id: userId,
          order_number: orderNumber,
          ...orderData,
          status: 'pending'
        }]);

      if (error) throw error;

      toast({
        title: "Pedido enviado!",
        description: `Seu pedido #${orderNumber} foi enviado com sucesso. Entraremos em contato em breve.`,
      });

      clearCart();
      setShowCheckout(false);
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar pedido. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {profile?.logo_url && (
              <img 
                src={profile.logo_url} 
                alt="Logo"
                className="w-12 h-12 object-cover rounded-full"
              />
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold">
                {profile?.restaurant_name || 'Cardápio Digital'}
              </h1>
              {profile?.description && (
                <p className="text-sm text-muted-foreground">{profile.description}</p>
              )}
            </div>
            
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <ShoppingCart className="h-4 w-4" />
                  {getCartItemCount() > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {getCartItemCount()}
                    </Badge>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[80vh]">
                <DrawerHeader>
                  <DrawerTitle>Carrinho ({getCartItemCount()} itens)</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 space-y-4 overflow-y-auto">
                  {cart.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Seu carrinho está vazio
                    </p>
                  ) : (
                    <>
                      {cart.map((item, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h4 className="font-medium">{item.name}</h4>
                                {item.selectedOptions && item.selectedOptions.length > 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    {item.selectedOptions.join(', ')}
                                  </p>
                                )}
                                {item.notes && (
                                  <p className="text-sm text-muted-foreground italic">
                                    Obs: {item.notes}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFromCart(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateCartItem(index, item.quantity - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="font-medium w-8 text-center">{item.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateCartItem(index, item.quantity + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <span className="font-bold">R$ {item.subtotal.toFixed(2)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-lg font-bold">Total:</span>
                          <span className="text-lg font-bold">R$ {getCartTotal().toFixed(2)}</span>
                        </div>
                        <Button 
                          onClick={() => {
                            setIsDrawerOpen(false);
                            setShowCheckout(true);
                          }}
                          className="w-full"
                          size="lg"
                        >
                          Finalizar Pedido
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('all')}
            className="shrink-0"
          >
            Todos
          </Button>
          {categories.map(category => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(category.id)}
              className="shrink-0"
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map(product => (
            <Card 
              key={product.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleProductClick(product)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg text-primary">
                        R$ {product.price.toFixed(2)}
                      </span>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Modals */}
      {selectedProduct && (
        <ProductVariationModal
          isOpen={showVariationModal}
          onClose={() => {
            setShowVariationModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          variations={productVariations}
          onAddToCart={addToCart}
        />
      )}

      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        cart={cart}
        total={getCartTotal()}
        onPlaceOrder={handlePlaceOrder}
      />

      {/* WhatsApp Button */}
      {profile?.phone && (
        <WhatsAppButton
          phoneNumber={profile.phone}
          message="Olá! Gostaria de fazer um pedido pelo cardápio digital."
        />
      )}
    </div>
  );
};

export default MenuDigital;
