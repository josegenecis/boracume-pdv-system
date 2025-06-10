
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface MobileCartButtonProps {
  cart: CartItem[];
  onOpenCart: () => void;
}

const MobileCartButton: React.FC<MobileCartButtonProps> = ({ cart, onOpenCart }) => {
  const getTotalValue = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  if (cart.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-50 md:hidden">
      <Button 
        onClick={onOpenCart}
        className="w-full flex items-center justify-between py-4 h-auto"
        size="lg"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart size={24} />
            {totalItems > 0 && (
              <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs">
                {totalItems}
              </Badge>
            )}
          </div>
          <span className="font-medium">Ver Carrinho</span>
        </div>
        <span className="font-bold text-lg">
          {formatCurrency(getTotalValue())}
        </span>
      </Button>
    </div>
  );
};

export default MobileCartButton;
