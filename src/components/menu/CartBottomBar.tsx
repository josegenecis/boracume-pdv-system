
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart } from 'lucide-react';

interface CartBottomBarProps {
  itemCount: number;
  total: number;
  onOpenCart: () => void;
}

const CartBottomBar: React.FC<CartBottomBarProps> = ({
  itemCount,
  total,
  onOpenCart
}) => {
  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Button 
          onClick={onOpenCart}
          className="w-full flex items-center justify-between h-14 text-lg"
          size="lg"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <ShoppingCart className="h-6 w-6" />
              <Badge 
                variant="secondary" 
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-white text-primary"
              >
                {itemCount}
              </Badge>
            </div>
            <span>Ver Carrinho</span>
          </div>
          <span className="font-bold">R$ {total.toFixed(2)}</span>
        </Button>
      </div>
    </div>
  );
};

export default CartBottomBar;
