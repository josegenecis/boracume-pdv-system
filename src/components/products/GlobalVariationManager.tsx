import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ProductVariationForm from './ProductVariationForm';

interface VariationOption {
  name: string;
  price: number;
}

interface GlobalVariation {
  id?: string;
  name: string;
  options: VariationOption[];
  description?: string;
}

const GlobalVariationManager: React.FC = () => {
  const [variations, setVariations] = useState<GlobalVariation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVariation, setEditingVariation] = useState<GlobalVariation | undefined>();
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

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
      toast({ title: 'Erro', description: 'Erro ao carregar variações globais.', variant: 'destructive' });
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
          updated_at: new Date().toISOString()
        };
        const { error } = await supabase
          .from('global_variations')
          .update(updateData)
          .eq('id', editingVariation.id);
        if (error) throw error;
      } else {
        const insertData = {
          user_id: user?.id,
          name: variationData.name,
          options: JSON.stringify(variationData.options),
          description: variationData.description || ''
        };
        const { error } = await supabase
          .from('global_variations')
          .insert(insertData);
        if (error) throw error;
      }
      toast({ title: 'Sucesso', description: `Variação global ${editingVariation ? 'atualizada' : 'criada'} com sucesso!` });
      setShowForm(false);
      setEditingVariation(undefined);
      fetchVariations();
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao salvar variação global.', variant: 'destructive' });
    }
  };

  const handleDeleteVariation = async (variationId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta variação global?')) return;
    try {
      const { error } = await supabase
        .from('global_variations')
        .delete()
        .eq('id', variationId);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Variação global excluída com sucesso.' });
      fetchVariations();
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir variação global.', variant: 'destructive' });
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8 text-gray-500">É necessário estar autenticado para gerenciar variações globais.</div>
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
            variations.map((variation) => (
              <Card key={variation.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{variation.name}</h4>
                      </div>
                      {variation.description && (
                        <div className="text-xs text-muted-foreground mb-1">{variation.description}</div>
                      )}
                      <div className="space-y-1">
                        {variation.options?.map((option, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{option.name}</span>
                            <span className="text-gray-600">{option.price > 0 ? `+R$ ${option.price.toFixed(2)}` : 'Grátis'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button variant="outline" size="sm" onClick={() => { setEditingVariation(variation); setShowForm(true); }}>
                        <Edit size={14} />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteVariation(variation.id!)}>
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

export default GlobalVariationManager;