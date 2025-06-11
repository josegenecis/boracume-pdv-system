
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Minus, MapPin, Phone, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ProductVariationModal from '@/components/products/ProductVariationModal';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  category: string;
  available: boolean;
  variations?: any[];
}

interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  variations: any[];
  notes: string;
  subtotal: number;
}

const MenuDigital = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      loadProfile();
      loadProducts();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      toast({
        title: "Erro",
        description: "Restaurante não encontrado.",
        variant: "destructive"
      });
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_variations (
            id,
            name,
            options,
            required,
            max_selections,
            price
          )
        `)
        .eq('user_id', userId)
        .eq('available', true)
        .eq('show_in_delivery', true);

      if (productsError) throw productsError;

      const formattedProducts = productsData?.map(product => ({
        ...product,
        variations: product.product_variations || []
      })) || [];

      setProducts(formattedProducts);
      
      const uniqueCategories = [...new Set(formattedProducts.map(p => p.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar cardápio.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (product: Product) => {
    if (product.variations && product.variations.length > 0) {
      setSelectedProduct(product);
      setShowVariationModal(true);
    } else {
      addToCart(product, [], '', 1);
    }
  };

  const addToCart = (product: Product, variations: any[], notes: string, quantity: number) => {
    const variationsPrice = variations.reduce((total, variation) => {
      if (Array.isArray(variation.selection)) {
        return total + variation.selection.reduce((sum: number, opt: any) => sum + opt.price, 0);
      } else if (variation.selection) {
        return total + variation.selection.price;
      }
      return total;
    }, 0);

    const subtotal = (product.price + variationsPrice) * quantity;

    const cartItem: CartItem = {
      id: `${product.id}-${Date.now()}`,
      product,
      quantity,
      variations,
      notes,
      subtotal
    };

    setCart(prev => [...prev, cartItem]);
    
    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  const updateCartItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      setCart(prev => prev.filter(item => item.id !== itemId));
    } else {
      setCart(prev => prev.map(item => {
        if (item.id === itemId) {
          const variationsPrice = item.variations.reduce((total, variation) => {
            if (Array.isArray(variation.selection)) {
              return total + variation.selection.reduce((sum: number, opt: any) => sum + opt.price, 0);
            } else if (variation.selection) {
              return total + variation.selection.price;
            }
            return total;
          }, 0);
          
          return {
            ...item,
            quantity: newQuantity,
            subtotal: (item.product.price + variationsPrice) * newQuantity
          };
        }
        return item;
      }));
    }
  };

  const getTotalCart = () => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  };

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Restaurante não encontrado</h1>
          <p className="text-gray-600">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{profile.restaurant_name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                {profile.phone && (
                  <div className="flex items-center gap-1">
                    <Phone size={14} />
                    {profile.phone}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  {profile.opening_hours || '10:00 - 22:00'}
                </div>
              </div>
            </div>
            <div className="relative">
              <Button size="sm" className="relative">
                <ShoppingCart size={16} />
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center p-0 text-xs">
                    {cart.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-20">
        {/* Categorias */}
        <div className="py-4">
          <div className="flex gap-2 overflow-x-auto">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="whitespace-nowrap"
            >
              Todos
            </Button>
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="whitespace-nowrap"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Produtos */}
        <div className="space-y-4">
          {filteredProducts.map(product => (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex">
                  {product.image_url && (
                    <div className="w-24 h-24 flex-shrink-0">
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">{product.name}</h3>
                      <span className="text-lg font-bold text-green-600">
                        R$ {product.price.toFixed(2)}
                      </span>
                    </div>
                    {product.description && (
                      <p className="text-sm text-gray-600 mb-3">{product.description}</p>
                    )}
                    
                    {product.variations && product.variations.length > 0 && (
                      <Badge variant="outline" className="mb-2">
                        Personalizável
                      </Badge>
                    )}

                    <Button 
                      size="sm" 
                      onClick={() => handleProductClick(product)}
                      className="w-full"
                    >
                      <Plus size={16} className="mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Carrinho fixo */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
            <div className="max-w-lg mx-auto p-4">
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-sm text-gray-600">
                        R$ {item.subtotal.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus size={12} />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus size={12} />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-green-600">
                      R$ {getTotalCart().toFixed(2)}
                    </span>
                  </div>
                  <Button className="w-full">
                    Finalizar Pedido
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ProductVariationModal
        isOpen={showVariationModal}
        onClose={() => setShowVariationModal(false)}
        product={selectedProduct!}
        onAddToCart={addToCart}
      />
    </div>
  );
};

export default MenuDigital;
