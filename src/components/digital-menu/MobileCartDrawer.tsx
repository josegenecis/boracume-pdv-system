
import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Trash2 } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface MobileCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  updateQuantity: (productId: string, newQuantity: number) => void;
  removeFromCart: (productId: string) => void;
  onCheckout: () => void;
  onWhatsAppOrder: () => void;
}

const MobileCartDrawer: React.FC<MobileCartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  updateQuantity,
  removeFromCart,
  onCheckout,
  onWhatsAppOrder
}) => {
  const getTotalValue = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Seu Carrinho ({cart.length} itens)</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {cart.map((item) => (
            <div key={item.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-sm leading-tight">{item.name}</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFromCart(item.id)}
                  className="h-6 w-6 p-0 text-red-500"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {formatCurrency(item.price)} cada
                </span>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Minus size={12} />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus size={12} />
                  </Button>
                </div>
              </div>
              
              <div className="text-right mt-2">
                <span className="font-bold text-primary">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">Total:</span>
            <span className="text-xl font-bold text-primary">
              {formatCurrency(getTotalValue())}
            </span>
          </div>
          
          <div className="space-y-2">
            <Button onClick={onCheckout} className="w-full" size="lg">
              Finalizar Pedido
            </Button>
            <Button 
              onClick={onWhatsAppOrder}
              variant="outline" 
              className="w-full"
              size="lg"
            >
              Pedir via WhatsApp
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileCartDrawer;
