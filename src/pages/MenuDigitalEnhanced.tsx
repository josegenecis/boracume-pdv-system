
import React from 'react';
import { Suspense } from 'react';
import EnhancedMenuDigital from '@/components/digital-menu/EnhancedMenuDigital';

const MenuDigitalEnhanced = () => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    }>
      <EnhancedMenuDigital />
    </Suspense>
  );
};

export default MenuDigitalEnhanced;
