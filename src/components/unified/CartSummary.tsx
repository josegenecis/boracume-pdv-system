
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, Trash2, Plus, Minus } from 'lucide-react';
import { CartItem } from '@/hooks/useUnifiedCart';

interface CartSummaryProps {
  items: CartItem[];
  total: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
  showCheckoutButton?: boolean;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  items,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  showCheckoutButton = true
}) => {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Carrinho vazio</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Carrinho ({items.length} {items.length === 1 ? 'item' : 'itens'})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <div className="flex-1">
              <h4 className="font-medium">{item.product.name}</h4>
              {item.variations.length > 0 && (
                <div className="text-sm text-gray-600 mt-1">
                  {item.variations.map(v => v.name).join(', ')}
                </div>
              )}
              {item.notes && (
                <div className="text-sm text-gray-500 italic mt-1">
                  Obs: {item.notes}
                </div>
              )}
              <div className="text-sm font-medium text-green-600 mt-1">
                R$ {item.unitPrice.toFixed(2)} cada
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Badge variant="secondary" className="min-w-[2rem] text-center">
                {item.quantity}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onRemoveItem(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="text-right min-w-[4rem]">
              <div className="font-bold">
                R$ {item.totalPrice.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
        
        <Separator />
        
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Total:</span>
          <span className="text-green-600">R$ {total.toFixed(2)}</span>
        </div>
        
        {showCheckoutButton && (
          <Button onClick={onCheckout} className="w-full" size="lg">
            Finalizar Pedido
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
