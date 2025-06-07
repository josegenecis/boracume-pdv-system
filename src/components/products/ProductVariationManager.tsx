
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VariationOption {
  name: string;
  price: number;
}

interface Variation {
  id?: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: VariationOption[];
}

interface ProductVariationManagerProps {
  productId: string;
  onClose: () => void;
}

const ProductVariationManager: React.FC<ProductVariationManagerProps> = ({ productId, onClose }) => {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchVariations();
  }, [productId]);

  const fetchVariations = async () => {
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      if (error) throw error;
      setVariations(data || []);
    } catch (error) {
      console.error('Erro ao carregar variações:', error);
    }
  };

  const addVariation = () => {
    setVariations([...variations, {
      name: '',
      required: false,
      max_selections: 1,
      options: [{ name: '', price: 0 }]
    }]);
  };

  const updateVariation = (index: number, field: string, value: any) => {
    const updated = [...variations];
    updated[index] = { ...updated[index], [field]: value };
    setVariations(updated);
  };

  const addOption = (variationIndex: number) => {
    const updated = [...variations];
    updated[variationIndex].options.push({ name: '', price: 0 });
    setVariations(updated);
  };

  const updateOption = (variationIndex: number, optionIndex: number, field: string, value: any) => {
    const updated = [...variations];
    updated[variationIndex].options[optionIndex] = {
      ...updated[variationIndex].options[optionIndex],
      [field]: value
    };
    setVariations(updated);
  };

  const removeOption = (variationIndex: number, optionIndex: number) => {
    const updated = [...variations];
    updated[variationIndex].options.splice(optionIndex, 1);
    setVariations(updated);
  };

  const removeVariation = (index: number) => {
    const updated = [...variations];
    updated.splice(index, 1);
    setVariations(updated);
  };

  const saveVariations = async () => {
    setLoading(true);
    try {
      // Remove variações existentes
      await supabase
        .from('product_variations')
        .delete()
        .eq('product_id', productId);

      // Salva novas variações
      const variationsToSave = variations
        .filter(v => v.name.trim() && v.options.some(o => o.name.trim()))
        .map(v => ({
          product_id: productId,
          name: v.name,
          required: v.required,
          max_selections: v.max_selections,
          options: v.options.filter(o => o.name.trim()),
          price: 0 // Campo obrigatório na tabela
        }));

      if (variationsToSave.length > 0) {
        const { error } = await supabase
          .from('product_variations')
          .insert(variationsToSave);

        if (error) throw error;
      }

      toast({
        title: "Variações salvas",
        description: "As variações do produto foram salvas com sucesso.",
      });

      onClose();
    } catch (error) {
      console.error('Erro ao salvar variações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar variações do produto.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Variações e Adicionais</h2>
        <div className="flex gap-2">
          <Button onClick={addVariation} variant="outline">
            <Plus size={16} className="mr-2" />
            Nova Variação
          </Button>
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {variations.map((variation, variationIndex) => (
          <Card key={variationIndex}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Variação {variationIndex + 1}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeVariation(variationIndex)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`variation-name-${variationIndex}`}>Nome</Label>
                  <Input
                    id={`variation-name-${variationIndex}`}
                    value={variation.name}
                    onChange={(e) => updateVariation(variationIndex, 'name', e.target.value)}
                    placeholder="Ex: Tamanho, Adicionais"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={variation.required}
                    onCheckedChange={(checked) => updateVariation(variationIndex, 'required', checked)}
                  />
                  <Label>Obrigatório</Label>
                </div>
                <div>
                  <Label htmlFor={`max-selections-${variationIndex}`}>Máx. Seleções</Label>
                  <Input
                    id={`max-selections-${variationIndex}`}
                    type="number"
                    min="1"
                    value={variation.max_selections}
                    onChange={(e) => updateVariation(variationIndex, 'max_selections', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Opções</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(variationIndex)}
                  >
                    <Plus size={14} className="mr-1" />
                    Opção
                  </Button>
                </div>

                {variation.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex gap-2 items-center">
                    <Input
                      value={option.name}
                      onChange={(e) => updateOption(variationIndex, optionIndex, 'name', e.target.value)}
                      placeholder="Nome da opção"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={option.price}
                      onChange={(e) => updateOption(variationIndex, optionIndex, 'price', parseFloat(e.target.value) || 0)}
                      placeholder="Preço adicional"
                      className="w-32"
                    />
                    {variation.options.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeOption(variationIndex, optionIndex)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {variations.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma variação adicionada. Clique em "Nova Variação" para começar.
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={onClose} variant="outline">
          Cancelar
        </Button>
        <Button onClick={saveVariations} disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar Variações'}
        </Button>
      </div>
    </div>
  );
};

export default ProductVariationManager;
