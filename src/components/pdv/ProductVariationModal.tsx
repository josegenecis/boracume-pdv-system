import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProductVariationSelector from './ProductVariationSelector';
import { useSidebar } from '@/contexts/SidebarContext';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
  weight_based?: boolean;
  send_to_kds?: boolean;
}

interface ProductVariation {
  id: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: Array<{name: string; price: number}>;
}

interface ProductVariationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  variations: ProductVariation[];
  onAddToCart: (product: Product, quantity: number, selectedVariations: any[], notes: string) => void;
}

const ProductVariationModal: React.FC<ProductVariationModalProps> = ({
  isOpen,
  onClose,
  product,
  variations,
  onAddToCart
}) => {
  const { isMobile } = useSidebar();

  const handleAddToCart = (product: Product, quantity: number, selectedVariations: any[], notes: string) => {
    onAddToCart(product, quantity, selectedVariations, notes);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={isMobile ? "max-w-[calc(100vw-1rem)] rounded-[24px] p-0" : "max-w-2xl max-h-[90vh] overflow-y-auto"}>
        <DialogHeader className={isMobile ? "border-b px-4 py-3" : ""}>
          <DialogTitle className={isMobile ? "text-[15px]" : ""}>Personalizar {product.name}</DialogTitle>
        </DialogHeader>

        <div className={isMobile ? "max-h-[76vh] overflow-y-auto px-4 py-3" : ""}>
          <ProductVariationSelector
            product={product}
            variations={variations}
            onAddToCart={handleAddToCart}
            onClose={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductVariationModal;
