
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { useUnifiedCart } from '@/hooks/useUnifiedCart';
import { ProductCard } from '@/components/unified/ProductCard';
import { CartSummary } from '@/components/unified/CartSummary';
import { CheckoutModal } from '@/components/unified/CheckoutModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart } from 'lucide-react';

const NewDigitalMenu = () => {
  const { userId } = useParams();
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const { products, categories, loading, error } = useProducts(userId || '');
  const {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    getTotal,
    getItemCount
  } = useUnifiedCart();

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Link Inválido</h1>
          <p className="text-gray-600">ID do usuário não encontrado</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500 mb-4 mx-auto"></div>
          <p className="text-lg">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Erro</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category === selectedCategory)
    : products;

  const itemCount = getItemCount();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto p-4">
          <h1 className="text-2xl font-bold">Cardápio Digital</h1>
          <p className="text-gray-600">Escolha seus produtos favoritos</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedCategory === '' ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory('')}
                    size="sm"
                  >
                    Todos
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.name ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(category.name)}
                      size="sm"
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={(product) => addItem(product, 1)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cart Sidebar (Desktop) */}
          <div className="hidden lg:block w-96">
            <div className="sticky top-4">
              <CartSummary
                items={items}
                total={getTotal()}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
                onCheckout={() => setShowCheckout(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Cart Button */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 right-4 lg:hidden">
          <Button
            onClick={() => setShowCart(true)}
            size="lg"
            className="rounded-full shadow-lg"
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            {itemCount}
            <Badge variant="secondary" className="ml-2">
              R$ {getTotal().toFixed(2)}
            </Badge>
          </Button>
        </div>
      )}

      {/* Mobile Cart Modal */}
      <CheckoutModal
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        items={items}
        total={getTotal()}
        userId={userId}
        onSuccess={() => {
          clearCart();
          setShowCart(false);
        }}
        context="digital-menu"
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        items={items}
        total={getTotal()}
        userId={userId}
        onSuccess={() => {
          clearCart();
          setShowCheckout(false);
        }}
        context="digital-menu"
      />
    </div>
  );
};

export default NewDigitalMenu;
