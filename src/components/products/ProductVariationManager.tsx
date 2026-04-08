
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import ProductVariationForm from './ProductVariationForm';

interface VariationOption {
  name: string;
  price: number;
  active?: boolean;
}

interface ProductVariation {
  id?: string;
  name: string;
  required: boolean;
  max_selections: number;
  active?: boolean;
  free_selections_limit?: number;
  allow_paid_excess?: boolean;
  paid_max_selections?: number | null;
  options: VariationOption[];
  product_id?: string;
  customer_label?: string;
  receipt_label?: string;
  display_order?: number;
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
  const confirm = useConfirmDialog();

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
        .order('display_order', { ascending: true });

      if (error) throw error;
      
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
          active: (item as any).active ?? true,
          free_selections_limit: (item as any).free_selections_limit ?? 0,
          allow_paid_excess: (item as any).allow_paid_excess ?? false,
          paid_max_selections: (item as any).paid_max_selections ?? null,
          options: Array.isArray(parsedOptions) ? parsedOptions : [],
          product_id: item.product_id,
          customer_label: item.customer_label || '',
          receipt_label: item.receipt_label || '',
          display_order: item.display_order ?? null
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

    // Verifica se já existe uma variação com o mesmo nome (ignorando maiúsculas/minúsculas)
    const nomeExiste = variations.some(v => v.name.trim().toLowerCase() === variationData.name.trim().toLowerCase() && v.id !== editingVariation?.id);
    if (nomeExiste) {
      toast({
        title: "Erro",
        description: "Já existe uma variação com este nome para este produto.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingVariation?.id) {
        const updateData = {
          name: variationData.name,
          required: variationData.required,
          max_selections: variationData.max_selections,
          active: variationData.active ?? true,
          free_selections_limit: variationData.free_selections_limit ?? 0,
          allow_paid_excess: variationData.allow_paid_excess ?? false,
          paid_max_selections: variationData.paid_max_selections ?? null,
          options: JSON.stringify(variationData.options),
          customer_label: (variationData as any).customer_label || '',
          receipt_label: (variationData as any).receipt_label || '',
          price: 0,
          updated_at: new Date().toISOString()
        };

        const first = await supabase.from('product_variations').update(updateData as any).eq('id', editingVariation.id);
        if ((first as any).error) {
          const msg = String((first as any).error?.message || '');
          if (msg.includes('customer_label') || msg.includes('receipt_label')) {
            const fallback = await supabase
              .from('product_variations')
              .update({ name: variationData.name, required: variationData.required, max_selections: variationData.max_selections, active: variationData.active ?? true, free_selections_limit: variationData.free_selections_limit ?? 0, allow_paid_excess: variationData.allow_paid_excess ?? false, paid_max_selections: variationData.paid_max_selections ?? null, options: JSON.stringify(variationData.options), price: 0, updated_at: new Date().toISOString() } as any)
              .eq('id', editingVariation.id);
            if ((fallback as any).error) throw (fallback as any).error;
          } else {
            throw (first as any).error;
          }
        }
      } else {
        const insertData = {
          product_id: productId,
          user_id: user?.id,
          name: variationData.name,
          required: variationData.required,
          max_selections: variationData.max_selections,
          active: variationData.active ?? true,
          free_selections_limit: variationData.free_selections_limit ?? 0,
          allow_paid_excess: variationData.allow_paid_excess ?? false,
          paid_max_selections: variationData.paid_max_selections ?? null,
          options: JSON.stringify(variationData.options),
          customer_label: (variationData as any).customer_label || '',
          receipt_label: (variationData as any).receipt_label || '',
          price: 0
        };

        const first = await supabase.from('product_variations').insert(insertData as any);
        if ((first as any).error) {
          const msg = String((first as any).error?.message || '');
          if (msg.includes('customer_label') || msg.includes('receipt_label')) {
            const fallback = await supabase
              .from('product_variations')
              .insert({ product_id: productId, user_id: user?.id, name: variationData.name, required: variationData.required, max_selections: variationData.max_selections, active: variationData.active ?? true, free_selections_limit: variationData.free_selections_limit ?? 0, allow_paid_excess: variationData.allow_paid_excess ?? false, paid_max_selections: variationData.paid_max_selections ?? null, options: JSON.stringify(variationData.options), price: 0 } as any);
            if ((fallback as any).error) throw (fallback as any).error;
          } else {
            throw (first as any).error;
          }
        }
      }

      const successMessage = `Variação ${editingVariation ? 'atualizada' : 'criada'} com sucesso.`;
      toast({
        title: "Sucesso",
        description: successMessage,
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

  const toggleVariationActive = async (variation: ProductVariation) => {
    try {
      const { error } = await supabase
        .from('product_variations')
        .update({ active: !(variation.active !== false), updated_at: new Date().toISOString() } as any)
        .eq('id', variation.id!);
      if (error) throw error;
      toast({ title: 'Sucesso', description: `Variação ${variation.active !== false ? 'ocultada' : 'ativada'} com sucesso.` });
      fetchVariations();
    } catch {
      toast({ title: 'Erro', description: 'Erro ao atualizar a visibilidade da variação.', variant: 'destructive' });
    }
  };

  const handleDeleteVariation = async (variationId: string) => {
    const ok = await confirm({
      title: 'Excluir variação',
      description: 'Tem certeza que deseja excluir esta variação?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;

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
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1 text-xs font-semibold text-boracume-orange">
            <Sparkles className="h-3.5 w-3.5" />
            Complementos do produto
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Variações do Produto</h3>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowForm(true)}
            size="sm"
            className="rounded-2xl bg-boracume-orange text-white hover:bg-orange-600 shadow-[0_18px_35px_-20px_rgba(249,115,22,0.8)]"
          >
            <Plus size={16} className="mr-1" />
            Nova Variação
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="rounded-2xl border-orange-200 bg-white/80 text-boracume-orange hover:bg-orange-50"
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
            <Card className="rounded-[28px] border border-orange-200/70 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/80">
              <CardContent className="text-center py-8">
                <p className="text-gray-500">Nenhuma variação configurada para este produto.</p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="mt-3 rounded-2xl bg-boracume-orange text-white hover:bg-orange-600"
                  size="sm"
                >
                  <Plus size={16} className="mr-1" />
                  Criar Primeira Variação
                </Button>
              </CardContent>
            </Card>
          ) : (
            variations.map((variation) => (
              <Card key={variation.id} className="overflow-hidden rounded-[26px] border border-orange-200/70 bg-white/85 shadow-[0_20px_50px_-35px_rgba(249,115,22,0.5)] backdrop-blur-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-slate-900">{variation.name}</h4>
                        {variation.required && (
                          <Badge variant="destructive" className="text-xs">
                            Obrigatório
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs border-orange-200 bg-orange-50 text-boracume-orange">
                          Máx: {variation.max_selections}
                        </Badge>
                        <Badge variant="outline" className={variation.active !== false ? 'text-xs border-orange-200 bg-orange-50 text-boracume-orange' : 'text-xs border-slate-200 bg-slate-100 text-slate-500'}>
                          {variation.active !== false ? 'Ativo' : 'Oculto'}
                        </Badge>
                        {(variation.free_selections_limit ?? 0) > 0 && (
                          <Badge variant="outline" className="text-xs border-emerald-200 bg-emerald-50 text-emerald-700">
                            Grátis até {variation.free_selections_limit}
                          </Badge>
                        )}
                        {variation.allow_paid_excess && (variation.paid_max_selections ?? 0) > variation.max_selections && (
                          <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                            Até {variation.paid_max_selections} com extras
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {variation.options?.map((option, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className={option.active === false ? 'text-gray-400 line-through' : ''}>{option.name}</span>
                            <span className="text-gray-600">
                              {option.active === false ? 'Oculto' : option.price > 0 ? `+${formatCurrency(option.price)}` : 'Grátis'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-2xl border-orange-200 bg-white/80 text-boracume-orange hover:bg-orange-50"
                        onClick={() => toggleVariationActive(variation)}
                      >
                        {variation.active !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-2xl border-orange-200 bg-white/80 text-boracume-orange hover:bg-orange-50"
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
                        className="rounded-2xl border-red-200 bg-white/80 text-red-500 hover:bg-red-50"
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
