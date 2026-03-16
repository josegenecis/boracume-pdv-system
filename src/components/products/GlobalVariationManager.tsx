import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import ProductVariationForm from './ProductVariationForm';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface VariationOption {
  name: string;
  price: number;
}

interface GlobalVariation {
  id?: string;
  name: string;
  options: VariationOption[];
  description?: string;
  customer_label?: string;
  receipt_label?: string;
}

const GlobalVariationManager: React.FC = () => {
  const [variations, setVariations] = useState<GlobalVariation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVariation, setEditingVariation] = useState<GlobalVariation | undefined>();
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const confirm = useConfirmDialog();

  useEffect(() => {
    if (user) {
      fetchVariations();
    }
  }, [user]);

  const fetchVariations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('global_variations')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');
      if (error) throw error;
      setVariations((data || []).map((variation: any) => ({
        ...variation,
        options: typeof variation.options === 'string' ? JSON.parse(variation.options) : variation.options
      })));
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar complementos.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVariation = async (variationData: GlobalVariation) => {
    try {
      if (editingVariation?.id) {
        const updateData = {
          name: variationData.name,
          options: JSON.stringify(variationData.options),
          description: variationData.description || '',
          customer_label: variationData.customer_label || '',
          receipt_label: variationData.receipt_label || '',
          updated_at: new Date().toISOString()
        };
        const first = await supabase.from('global_variations').update(updateData as any).eq('id', editingVariation.id);
        if ((first as any).error) {
          const msg = String((first as any).error?.message || '');
          if (msg.includes('customer_label') || msg.includes('receipt_label')) {
            const fallback = await supabase
              .from('global_variations')
              .update({ name: variationData.name, options: JSON.stringify(variationData.options), description: variationData.description || '', updated_at: new Date().toISOString() } as any)
              .eq('id', editingVariation.id);
            if ((fallback as any).error) throw (fallback as any).error;
          } else {
            throw (first as any).error;
          }
        }
      } else {
        const insertData = {
          user_id: user?.id,
          name: variationData.name,
          options: JSON.stringify(variationData.options),
          description: variationData.description || '',
          customer_label: variationData.customer_label || '',
          receipt_label: variationData.receipt_label || ''
        };
        const first = await supabase.from('global_variations').insert(insertData as any);
        if ((first as any).error) {
          const msg = String((first as any).error?.message || '');
          if (msg.includes('customer_label') || msg.includes('receipt_label')) {
            const fallback = await supabase
              .from('global_variations')
              .insert({ user_id: user?.id, name: variationData.name, options: JSON.stringify(variationData.options), description: variationData.description || '' } as any);
            if ((fallback as any).error) throw (fallback as any).error;
          } else {
            throw (first as any).error;
          }
        }
      }
      toast({ title: 'Sucesso', description: `Complemento ${editingVariation ? 'atualizado' : 'criado'} com sucesso!` });
      setShowForm(false);
      setEditingVariation(undefined);
      fetchVariations();
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao salvar complemento.', variant: 'destructive' });
    }
  };

  const handleDeleteVariation = async (variationId: string) => {
    const ok = await confirm({
      title: 'Excluir complemento',
      description: 'Tem certeza que deseja excluir este complemento?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('global_variations')
        .delete()
        .eq('id', variationId);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Complemento excluído com sucesso.' });
      fetchVariations();
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir complemento.', variant: 'destructive' });
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8 text-gray-500">É necessário estar autenticado para gerenciar complementos.</div>
    );
  }

  if (showForm) {
    return (
      <ProductVariationForm
        variation={editingVariation}
        onSave={handleSaveVariation}
        onCancel={() => { setShowForm(false); setEditingVariation(undefined); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Variações Globais</h3>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus size={16} className="mr-1" /> Nova Variação Global
        </Button>
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
                <p className="text-gray-500">Nenhuma variação global cadastrada.</p>
                <Button onClick={() => setShowForm(true)} className="mt-3" size="sm">
                  <Plus size={16} className="mr-1" /> Criar Nova Variação Global
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {variations.map((variation) => (
                <AccordionItem key={variation.id} value={String(variation.id)}>
                  <Card>
                    <CardContent className="p-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex-1 text-left">
                          <div className="font-medium">{variation.name}</div>
                          {variation.description && (
                            <div className="text-xs text-muted-foreground mt-1">{variation.description}</div>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-2">
                          {variation.options?.map((option, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{option.name}</span>
                              <span className="text-gray-600">
                                {option.price > 0 ? `+R$ ${option.price.toFixed(2)}` : 'Grátis'}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 justify-end mt-4">
                          <Button variant="outline" size="sm" onClick={() => { setEditingVariation(variation); setShowForm(true); }}>
                            <Edit size={14} className="mr-2" /> Editar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteVariation(variation.id!)}>
                            <Trash2 size={14} className="mr-2" /> Excluir
                          </Button>
                        </div>
                      </AccordionContent>
                    </CardContent>
                  </Card>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalVariationManager;
