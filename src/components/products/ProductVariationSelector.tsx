
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface VariationOption {
  name: string;
  price: number;
}

interface ProductVariation {
  id: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: VariationOption[];
}

interface SelectedOptions {
  [variationId: string]: string[];
}

interface ProductVariationSelectorProps {
  variations: ProductVariation[];
  selectedOptions: SelectedOptions;
  onSelectionChange: (variationId: string, options: string[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const ProductVariationSelector: React.FC<ProductVariationSelectorProps> = ({
  variations,
  selectedOptions,
  onSelectionChange,
  onConfirm,
  onCancel
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const calculateTotalPrice = () => {
    let total = 0;
    variations.forEach(variation => {
      const selected = selectedOptions[variation.id] || [];
      selected.forEach(optionName => {
        const option = variation.options.find(opt => opt.name === optionName);
        if (option) total += option.price;
      });
    });
    return total;
  };

  const isValidSelection = () => {
    return variations.every(variation => {
      const selected = selectedOptions[variation.id] || [];
      if (variation.required && selected.length === 0) {
        return false;
      }
      return selected.length <= variation.max_selections;
    });
  };

  const handleSingleSelection = (variationId: string, optionName: string) => {
    onSelectionChange(variationId, [optionName]);
  };

  const handleMultipleSelection = (variationId: string, optionName: string, checked: boolean) => {
    const current = selectedOptions[variationId] || [];
    if (checked) {
      const variation = variations.find(v => v.id === variationId);
      if (variation && current.length < variation.max_selections) {
        onSelectionChange(variationId, [...current, optionName]);
      }
    } else {
      onSelectionChange(variationId, current.filter(name => name !== optionName));
    }
  };

  if (variations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      <h3 className="text-lg font-semibold">Selecione as opções</h3>
      
      {variations.map(variation => (
        <Card key={variation.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{variation.name}</CardTitle>
              <div className="flex gap-2">
                {variation.required && (
                  <Badge variant="destructive" className="text-xs">
                    Obrigatório
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  Máx: {variation.max_selections}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {variation.max_selections === 1 ? (
              <RadioGroup
                value={selectedOptions[variation.id]?.[0] || ''}
                onValueChange={(value) => handleSingleSelection(variation.id, value)}
              >
                {variation.options.map((option, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={option.name} id={`${variation.id}-${index}`} />
                      <Label htmlFor={`${variation.id}-${index}`}>{option.name}</Label>
                    </div>
                    <span className="text-sm text-gray-600">
                      {option.price > 0 ? `+${formatCurrency(option.price)}` : 'Grátis'}
                    </span>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="space-y-2">
                {variation.options.map((option, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`${variation.id}-${index}`}
                        checked={selectedOptions[variation.id]?.includes(option.name) || false}
                        onCheckedChange={(checked) => 
                          handleMultipleSelection(variation.id, option.name, checked as boolean)
                        }
                        disabled={
                          !selectedOptions[variation.id]?.includes(option.name) &&
                          (selectedOptions[variation.id]?.length || 0) >= variation.max_selections
                        }
                      />
                      <Label htmlFor={`${variation.id}-${index}`}>{option.name}</Label>
                    </div>
                    <span className="text-sm text-gray-600">
                      {option.price > 0 ? `+${formatCurrency(option.price)}` : 'Grátis'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {calculateTotalPrice() > 0 && (
        <div className="text-right">
          <span className="text-lg font-semibold">
            Total adicional: {formatCurrency(calculateTotalPrice())}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Button 
          onClick={onConfirm} 
          disabled={!isValidSelection()}
          className="flex-1"
        >
          Confirmar
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
};

export default ProductVariationSelector;
