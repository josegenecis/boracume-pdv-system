
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeComplementOptionName } from '@/lib/text';
import { Trash2, Plus, Copy, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CurrencyInput } from '@/components/ui/currency-input';
import { IntegerInput } from '@/components/ui/integer-input';

interface VariationOption {
  name: string;
  price: number;
  active?: boolean;
}

interface ProductVariation {
  id?: string;
  name: string;
  customer_label?: string;
  receipt_label?: string;
  description?: string;
  required?: boolean;
  max_selections?: number;
  active?: boolean;
  free_selections_limit?: number;
  allow_paid_excess?: boolean;
  paid_max_selections?: number | null;
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
    customer_label: (variation as any)?.customer_label || '',
    receipt_label: (variation as any)?.receipt_label || '',
    description: (variation as any)?.description || '',
    required: (variation as any)?.required ?? false,
    max_selections: (variation as any)?.max_selections ?? 1,
    active: (variation as any)?.active ?? true,
    free_selections_limit: (variation as any)?.free_selections_limit ?? 0,
    allow_paid_excess: (variation as any)?.allow_paid_excess ?? false,
    paid_max_selections: (variation as any)?.paid_max_selections ?? null,
    options: variation?.options || [{ name: '', price: 0, active: true }],
    ...variation
  });
  const [maxSelectionsRaw, setMaxSelectionsRaw] = useState(String((variation as any)?.max_selections ?? 1));
  const [freeSelectionsRaw, setFreeSelectionsRaw] = useState(String((variation as any)?.free_selections_limit ?? 0));
  const [paidMaxSelectionsRaw, setPaidMaxSelectionsRaw] = useState(String((variation as any)?.paid_max_selections ?? (variation as any)?.max_selections ?? 1));
  
  const { toast } = useToast();

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, { name: '', price: 0, active: true }]
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

  const duplicateOption = (index: number) => {
    setFormData(prev => {
      const option = prev.options[index];
      if (!option) return prev;
      const duplicated = {
        ...option,
        name: option.name ? `${option.name} (cópia)` : ''
      };
      const nextOptions = [...prev.options];
      nextOptions.splice(index + 1, 0, duplicated);
      return {
        ...prev,
        options: nextOptions
      };
    });
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

    const validOptions = formData.options
      .filter(option => option.name.trim())
      .map(option => ({
        ...option,
        name: normalizeComplementOptionName(option.name),
        active: option.active !== false
      }));
    if (validOptions.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma opção válida.",
        variant: "destructive"
      });
      return;
    }

    const maxSelections = Math.max(1, Number(formData.max_selections || 1));
    const freeSelectionsLimit = Math.max(0, Number(formData.free_selections_limit || 0));
    const paidMaxSelections = formData.allow_paid_excess
      ? Math.max(maxSelections, Number(formData.paid_max_selections || maxSelections))
      : null;

    onSave({
      ...formData,
      max_selections: maxSelections,
      free_selections_limit: Math.min(freeSelectionsLimit, paidMaxSelections ?? maxSelections),
      paid_max_selections: paidMaxSelections,
      options: validOptions
    });
  };

  const fieldClassName = 'mt-2 rounded-2xl border border-[#FF6400]/15 bg-white/85 backdrop-blur-md shadow-[0_10px_26px_-22px_rgba(0,50,35,0.16)] focus-visible:ring-2 focus-visible:ring-[#FF6400]/30 focus-visible:ring-offset-0';
  const softButtonClassName = 'rounded-2xl border-[#003223]/12 bg-white/80 text-[#003223] hover:bg-[#F5EBE1] hover:text-[#003223]';
  const selectedButtonClassName = 'rounded-2xl border-[#8CC850] bg-[#8CC850] text-[#003223] hover:bg-[#79b541]';

  return (
    <Card className="overflow-hidden rounded-[28px] border border-[#FF6400]/12 bg-gradient-to-br from-[#FFF8F2] via-white to-[#F5EBE1]/55 shadow-[0_24px_60px_-35px_rgba(0,50,35,0.18)] backdrop-blur-xl">
      <CardHeader className="border-b border-[#FF6400]/10 bg-white/75 backdrop-blur-md">
        <CardTitle className="text-slate-900">
          {variation ? 'Editar Variação' : 'Nova Variação'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onCancel} className={softButtonClassName}>
              <ArrowLeft size={16} className="mr-2" />
              Voltar
            </Button>
          </div>
          <div>
            <Label htmlFor="name" className="text-boracume-dark-green font-semibold">Nome da Variação</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Tamanho, Adicionais, etc."
              required
              className={fieldClassName}
            />
          </div>

          <div>
            <Label htmlFor="customer_label" className="text-boracume-dark-green font-semibold">Texto para o cliente</Label>
            <Input
              id="customer_label"
              value={formData.customer_label || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, customer_label: e.target.value }))}
              placeholder="Ex: SELECIONE O SABOR"
              className={fieldClassName}
            />
          </div>

          <div>
            <Label htmlFor="receipt_label" className="text-boracume-dark-green font-semibold">Texto para o cupom</Label>
            <Input
              id="receipt_label"
              value={formData.receipt_label || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, receipt_label: e.target.value }))}
              placeholder="Ex: SABOR"
              className={fieldClassName}
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-boracume-dark-green font-semibold">Descrição</Label>
            <Input
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Opcional"
              className={fieldClassName}
            />
          </div>

          <div className="grid gap-3 rounded-[24px] border border-[#FF6400]/12 bg-[#FFF8F2]/80 p-4 shadow-[0_18px_45px_-30px_rgba(0,50,35,0.16)] backdrop-blur-md">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className={formData.required ? selectedButtonClassName : softButtonClassName}
                onClick={() => setFormData(prev => ({ ...prev, required: !prev.required }))}
              >
                {formData.required ? 'Obrigatório' : 'Opcional'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={formData.active !== false ? selectedButtonClassName : softButtonClassName}
                onClick={() => setFormData(prev => ({ ...prev, active: !(prev.active !== false) }))}
              >
                {formData.active !== false ? 'Visível no cardápio' : 'Oculto no cardápio'}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="max_selections" className="text-boracume-dark-green font-semibold">Máximo padrão</Label>
                <IntegerInput
                  id="max_selections"
                  min={1}
                  value={maxSelectionsRaw}
                  fallback={formData.max_selections ?? 1}
                  onValueChange={(value) => {
                    setMaxSelectionsRaw(value);
                    if (value !== '') {
                      setFormData(prev => ({ ...prev, max_selections: Math.max(1, Number(value) || 1) }));
                    }
                  }}
                  className={fieldClassName}
                />
              </div>
              <div>
                <Label htmlFor="free_selections_limit" className="text-boracume-dark-green font-semibold">Grátis até</Label>
                <IntegerInput
                  id="free_selections_limit"
                  min={0}
                  value={freeSelectionsRaw}
                  fallback={formData.free_selections_limit ?? 0}
                  onValueChange={(value) => {
                    setFreeSelectionsRaw(value);
                    if (value !== '') {
                      setFormData(prev => ({ ...prev, free_selections_limit: Math.max(0, Number(value) || 0) }));
                    }
                  }}
                  className={fieldClassName}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
              <Button
                type="button"
                variant="outline"
                className={formData.allow_paid_excess ? selectedButtonClassName : softButtonClassName}
                onClick={() => setFormData(prev => ({
                  ...prev,
                  allow_paid_excess: !prev.allow_paid_excess,
                  paid_max_selections: !prev.allow_paid_excess ? Math.max(prev.max_selections ?? 1, prev.paid_max_selections ?? prev.max_selections ?? 1) : null
                }))}
              >
                {formData.allow_paid_excess ? 'Extras pagos liberados' : 'Liberar extras pagos'}
              </Button>
              <IntegerInput
                min={Math.max(1, Number(formData.max_selections || 1))}
                disabled={!formData.allow_paid_excess}
                value={paidMaxSelectionsRaw}
                fallback={formData.paid_max_selections ?? formData.max_selections ?? 1}
                onValueChange={(value) => {
                  setPaidMaxSelectionsRaw(value);
                  if (value !== '') {
                    setFormData(prev => ({ ...prev, paid_max_selections: Math.max(Number(prev.max_selections || 1), Number(value || prev.max_selections || 1)) }));
                  }
                }}
                className={fieldClassName}
              />
            </div>
            <div className="text-xs text-slate-500">
              Se o complemento for grátis até um limite, use o preço das opções como valor cobrado nos adicionais que excederem esse limite.
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-boracume-dark-green font-semibold">Opções</Label>
              <Button type="button" onClick={addOption} size="sm" variant="outline" className={softButtonClassName}>
                <Plus size={16} className="mr-1" />
                Adicionar Opção
              </Button>
            </div>

            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div key={index} className="flex gap-2 items-end rounded-[22px] border border-[#FF6400]/10 bg-white/80 p-3 shadow-[0_10px_30px_-24px_rgba(0,50,35,0.14)] backdrop-blur-sm">
                  <div className="flex-1">
                    <Label htmlFor={`option-name-${index}`} className="text-boracume-dark-green font-semibold">Nome</Label>
                    <Input
                      id={`option-name-${index}`}
                      value={option.name}
                      onChange={(e) => updateOption(index, 'name', e.target.value)}
                      placeholder="Nome da opção"
                      className={fieldClassName}
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`option-price-${index}`} className="text-boracume-dark-green font-semibold">Preço extra</Label>
                    <CurrencyInput
                      id={`option-price-${index}`}
                      value={option.price}
                      onValueChange={(v) => updateOption(index, 'price', v)}
                      className={fieldClassName}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => updateOption(index, 'active', !(option.active !== false))}
                    className={softButtonClassName}
                  >
                    {option.active !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => duplicateOption(index)}
                    className={softButtonClassName}
                  >
                    <Copy size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeOption(index)}
                    disabled={formData.options.length === 1}
                    className={softButtonClassName}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} className={softButtonClassName}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-2xl bg-boracume-orange text-white hover:bg-orange-600 shadow-[0_20px_45px_-25px_rgba(249,115,22,0.75)]">
              Salvar Variação
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProductVariationForm;
