
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings } from 'lucide-react';
import ProductVariationManager from './ProductVariationManager';

interface ProductVariationsButtonProps {
  productId: string;
  compact?: boolean;
}

const ProductVariationsButton: React.FC<ProductVariationsButtonProps> = ({ productId, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={compact ? 'h-8 px-2' : undefined}>
          <Settings size={16} className={compact ? '' : 'mr-1'} />
          <span className={compact ? 'hidden sm:inline ml-1' : ''}>Variações</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Variações</DialogTitle>
        </DialogHeader>
        <ProductVariationManager 
          productId={productId} 
          onClose={() => setIsOpen(false)} 
        />
      </DialogContent>
    </Dialog>
  );
};

export default ProductVariationsButton;
