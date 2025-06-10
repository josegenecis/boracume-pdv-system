
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ProductVariationForm from './ProductVariationForm';

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
  product_id?: string;
}

interface ProductVariationManagerProps {
  productId: string;
  onClose: () => void;
}

const ProductVariationManager: React.FC<ProductVariationManagerProps> = ({ 
  productId, 
  onClose 
}) => {
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVariation, setEditingVariation] = useState<ProductVariation | undefined>();
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchVariations();
  }, [productId]);

  const fetchVariations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId)
        .order('name');

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedData = (data || []).map(item => {
        let parsedOptions = [];
        try {
          if (typeof item.options === 'string') {
            parsedOptions = JSON.parse(item.options);
          } else if (Array.isArray(item.options)) {
            parsedOptions = item.options;
          }
        } catch (e) {
          console.error('Error parsing options:', e);
          parsedOptions = [];
        }

        return {
          id: item.id,
          name: item.name,
          required: item.required,
          max_selections: item.max_selections,
          options: Array.isArray(parsedOptions) ? parsedOptions : [],
          product_id: item.product_id
        };
      });
      
      setVariations(transformedData);
    } catch (error) {
      console.error('Erro ao carregar variações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar variações do produto.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVariation = async (variationData: ProductVariation) => {
    try {
      if (editingVariation?.id) {
        // Atualizar variação existente
        const { error } = await supabase
          .from('product_variations')
          .update({
            name: variationData.name,
            required: variationData.required,
            max_selections: variationData.max_selections,
            options: JSON.stringify(variationData.options),
            price: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingVariation.id);

        if (error) throw error;
      } else {
        // Criar nova variação
        const { error } = await supabase
          .from('product_variations')
          .insert({
            product_id: productId,
            user_id: user?.id,
            name: variationData.name,
            required: variationData.required,
            max_selections: variationData.max_selections,
            options: JSON.stringify(variationData.options),
            price: 0
          });

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: `Variação ${editingVariation ? 'atualizada' : 'criada'} com sucesso.`,
      });

      setShowForm(false);
      setEditingVariation(undefined);
      fetchVariations();
    } catch (error) {
      console.error('Erro ao salvar variação:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar variação.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteVariation = async (variationId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta variação?')) return;

    try {
      const { error } = await supabase
        .from('product_variations')
        .delete()
        .eq('id', variationId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Variação excluída com sucesso.",
      });

      fetchVariations();
    } catch (error) {
      console.error('Erro ao excluir variação:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir variação.",
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

  if (showForm) {
    return (
      <ProductVariationForm
        variation={editingVariation}
        onSave={handleSaveVariation}
        onCancel={() => {
          setShowForm(false);
          setEditingVariation(undefined);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Variações do Produto</h3>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowForm(true)}
            size="sm"
          >
            <Plus size={16} className="mr-1" />
            Nova Variação
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
          >
            Fechar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {variations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">Nenhuma variação configurada para este produto.</p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="mt-3"
                  size="sm"
                >
                  <Plus size={16} className="mr-1" />
                  Criar Primeira Variação
                </Button>
              </CardContent>
            </Card>
          ) : (
            variations.map((variation) => (
              <Card key={variation.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{variation.name}</h4>
                        {variation.required && (
                          <Badge variant="destructive" className="text-xs">
                            Obrigatório
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          Máx: {variation.max_selections}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        {variation.options?.map((option, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{option.name}</span>
                            <span className="text-gray-600">
                              {option.price > 0 ? `+${formatCurrency(option.price)}` : 'Grátis'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingVariation(variation);
                          setShowForm(true);
                        }}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteVariation(variation.id!)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ProductVariationManager;
