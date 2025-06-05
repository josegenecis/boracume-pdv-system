
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ProductVariation {
  id: string;
  name: string;
  price: number;
  required: boolean;
  max_selections: number;
  options: any[];
}

interface ProductVariationsFormProps {
  productId: string;
  onClose?: () => void;
}

const ProductVariationsForm: React.FC<ProductVariationsFormProps> = ({ productId, onClose }) => {
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [newVariation, setNewVariation] = useState({
    name: '',
    price: '',
    required: false,
    max_selections: 1
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadVariations();
  }, [productId]);

  const loadVariations = async () => {
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId)
        .order('name');

      if (error) throw error;
      setVariations(data || []);
    } catch (error) {
      console.error('Erro ao carregar variações:', error);
    }
  };

  const addVariation = async () => {
    if (!newVariation.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome da variação.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const variationData = {
        product_id: productId,
        user_id: user?.id,
        name: newVariation.name.trim(),
        price: parseFloat(newVariation.price) || 0,
        required: newVariation.required,
        max_selections: newVariation.max_selections,
        options: []
      };

      const { data, error } = await supabase
        .from('product_variations')
        .insert([variationData])
        .select()
        .single();

      if (error) throw error;

      setVariations(prev => [...prev, data]);
      setNewVariation({ name: '', price: '', required: false, max_selections: 1 });

      toast({
        title: "Variação adicionada",
        description: `${variationData.name} foi adicionada com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao adicionar variação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a variação.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeVariation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('product_variations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setVariations(prev => prev.filter(v => v.id !== id));

      toast({
        title: "Variação removida",
        description: "A variação foi removida com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao remover variação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a variação.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Variações e Adicionais
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Voltar
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulário para nova variação */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
          <div className="space-y-2">
            <Label>Nome da Variação</Label>
            <Input
              placeholder="Ex: Tamanho, Adicionais"
              value={newVariation.name}
              onChange={(e) => setNewVariation(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Preço Extra (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={newVariation.price}
              onChange={(e) => setNewVariation(prev => ({ ...prev, price: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Max. Seleções</Label>
            <Input
              type="number"
              min="1"
              value={newVariation.max_selections}
              onChange={(e) => setNewVariation(prev => ({ ...prev, max_selections: parseInt(e.target.value) || 1 }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Obrigatório</Label>
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                checked={newVariation.required}
                onCheckedChange={(checked) => setNewVariation(prev => ({ ...prev, required: checked }))}
              />
              <span className="text-sm text-muted-foreground">
                {newVariation.required ? 'Sim' : 'Não'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>&nbsp;</Label>
            <Button onClick={addVariation} disabled={loading} className="w-full">
              <Plus size={16} className="mr-2" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Lista de variações */}
        <div className="space-y-3">
          <h4 className="font-medium">Variações Cadastradas</h4>
          {variations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma variação cadastrada ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {variations.map((variation) => (
                <div key={variation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{variation.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Preço: {formatCurrency(variation.price)} | 
                      Max: {variation.max_selections} | 
                      {variation.required ? 'Obrigatório' : 'Opcional'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={variation.required ? "default" : "secondary"}>
                      {variation.required ? 'Obrigatório' : 'Opcional'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      <Edit size={14} />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeVariation(variation.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductVariationsForm;
