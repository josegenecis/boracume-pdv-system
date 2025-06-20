
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProductVariationSelector from './ProductVariationSelector';

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
  onAddToCart: (product: Product, quantity: number, selectedVariations: any[], notes: string, variationPrice: number) => void;
  onAddToTable?: (product: Product, quantity: number, selectedVariations: any[], notes: string, variationPrice: number) => void;
  showTableOption?: boolean;
}

const ProductVariationModal: React.FC<ProductVariationModalProps> = ({
  isOpen,
  onClose,
  product,
  onAddToCart,
  onAddToTable,
  showTableOption = false
}) => {
  const handleAddToCart = (product: Product, quantity: number, selectedVariations: any[], notes: string, variationPrice: number) => {
    onAddToCart(product, quantity, selectedVariations, notes, variationPrice);
    onClose();
  };

  const handleAddToTable = (product: Product, quantity: number, selectedVariations: any[], notes: string, variationPrice: number) => {
    if (onAddToTable) {
      onAddToTable(product, quantity, selectedVariations, notes, variationPrice);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalizar {product?.name}</DialogTitle>
        </DialogHeader>
        
        <ProductVariationSelector
          product={product}
          variations={[]}
          onAddToCart={handleAddToCart}
          onAddToTable={showTableOption ? handleAddToTable : undefined}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ProductVariationModal;
