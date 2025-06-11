
import React from 'react';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import EnhancedMenuDigital from '@/components/digital-menu/EnhancedMenuDigital';

const MenuDigitalEnhanced = () => {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando menu digital...</p>
          </div>
        </div>
      }>
        <EnhancedMenuDigital />
      </Suspense>
    </div>
  );
};

export default MenuDigitalEnhanced;
