import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Heart, Home, ShoppingCart, UserRound } from 'lucide-react';

interface MenuBottomNavProps {
  itemCount: number;
  onOpenCart: () => void;
  onHome?: () => void;
}

const MenuBottomNav: React.FC<MenuBottomNavProps> = ({ itemCount, onOpenCart, onHome }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 mobile-safe-bottom">
      <div className="bg-boracume-orange">
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <button type="button" className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-white" onClick={onHome}>
              <Home className="h-6 w-6" />
            </button>
            <button type="button" className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
              <Heart className="h-6 w-6" />
            </button>
            <button type="button" className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center text-boracume-orange shadow-sm relative" onClick={onOpenCart}>
              <ShoppingCart className="h-6 w-6" />
              {itemCount > 0 ? (
                <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-boracume-orange text-white border-2 border-white">
                  {itemCount}
                </Badge>
              ) : null}
            </button>
            <button type="button" className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
              <UserRound className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuBottomNav;

