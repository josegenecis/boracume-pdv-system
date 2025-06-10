
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VariationOption {
  name: string;
  price: number;
}

interface ProductVariation {
  id?: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: VariationOption[];
}

interface ProductVariationFormProps {
  variation?: ProductVariation;
  onSave: (variation: ProductVariation) => void;
  onCancel: () => void;
}

const ProductVariationForm: React.FC<ProductVariationFormProps> = ({
  variation,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<ProductVariation>({
    name: variation?.name || '',
    required: variation?.required || false,
    max_selections: variation?.max_selections || 1,
    options: variation?.options || [{ name: '', price: 0 }],
    ...variation
  });
  
  const { toast } = useToast();

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, { name: '', price: 0 }]
    }));
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index: number, field: keyof VariationOption, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((option, i) => 
        i === index ? { ...option, [field]: value } : option
      )
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da variação é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    const validOptions = formData.options.filter(option => option.name.trim());
    if (validOptions.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma opção válida.",
        variant: "destructive"
      });
      return;
    }

    onSave({
      ...formData,
      options: validOptions
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {variation ? 'Editar Variação' : 'Nova Variação'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome da Variação</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Tamanho, Adicionais, etc."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="required"
                checked={formData.required}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, required: checked as boolean }))
                }
              />
              <Label htmlFor="required">Obrigatório</Label>
            </div>

            <div>
              <Label htmlFor="max_selections">Máximo de Seleções</Label>
              <Input
                id="max_selections"
                type="number"
                min="1"
                value={formData.max_selections}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  max_selections: parseInt(e.target.value) || 1 
                }))}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Opções</Label>
              <Button type="button" onClick={addOption} size="sm" variant="outline">
                <Plus size={16} className="mr-1" />
                Adicionar Opção
              </Button>
            </div>

            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label htmlFor={`option-name-${index}`}>Nome</Label>
                    <Input
                      id={`option-name-${index}`}
                      value={option.name}
                      onChange={(e) => updateOption(index, 'name', e.target.value)}
                      placeholder="Nome da opção"
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`option-price-${index}`}>Preço Adicional</Label>
                    <Input
                      id={`option-price-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={option.price}
                      onChange={(e) => updateOption(index, 'price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeOption(index)}
                    disabled={formData.options.length === 1}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar Variação
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProductVariationForm;
