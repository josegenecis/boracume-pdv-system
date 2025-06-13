import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Copy, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface VariationOption {
  name: string;
  price: number;
}

interface GlobalVariation {
  id: string;
  name: string;
  description?: string;
  max_selections: number;
  required: boolean;
  options: VariationOption[];
  created_at: string;
}

const GlobalVariationsManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [globalVariations, setGlobalVariations] = useState<GlobalVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVariation, setEditingVariation] = useState<GlobalVariation | null>(null);
  const [newVariation, setNewVariation] = useState({
    name: '',
    description: '',
    max_selections: 1,
    required: false,
    options: [{ name: '', price: 0 }]
  });

  useEffect(() => {
    if (user) {
      fetchGlobalVariations();
    }
  }, [user]);

  const fetchGlobalVariations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('global_variations')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedVariations = (data || []).map(variation => ({
        ...variation,
        options: Array.isArray(variation.options) ? (variation.options as unknown) as VariationOption[] : []
      }));
      
      setGlobalVariations(formattedVariations);
    } catch (error) {
      console.error('Erro ao carregar variações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as variações.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addOption = () => {
    setNewVariation(prev => ({
      ...prev,
      options: [...prev.options, { name: '', price: 0 }]
    }));
  };

  const removeOption = (index: number) => {
    setNewVariation(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index: number, field: 'name' | 'price', value: string | number) => {
    setNewVariation(prev => ({
      ...prev,
      options: prev.options.map((option, i) => 
        i === index ? { ...option, [field]: value } : option
      )
    }));
  };

  const saveVariation = async () => {
    if (!newVariation.name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da variação é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    if (newVariation.options.some(opt => !opt.name.trim())) {
      toast({
        title: "Erro",
        description: "Todas as opções devem ter um nome.",
        variant: "destructive"
      });
      return;
    }

    try {
      const variationData = {
        user_id: user?.id,
        name: newVariation.name,
        description: newVariation.description,
        max_selections: newVariation.max_selections,
        required: newVariation.required,
        options: newVariation.options as any
      };

      if (editingVariation) {
        const { error } = await supabase
          .from('global_variations')
          .update(variationData)
          .eq('id', editingVariation.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_variations')
          .insert(variationData);

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: `Variação ${editingVariation ? 'atualizada' : 'criada'} com sucesso!`
      });

      resetForm();
      fetchGlobalVariations();
    } catch (error) {
      console.error('Erro ao salvar variação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a variação.",
        variant: "destructive"
      });
    }
  };

  const deleteVariation = async (variationId: string) => {
    try {
      const { error } = await supabase
        .from('global_variations')
        .delete()
        .eq('id', variationId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Variação excluída com sucesso!"
      });

      fetchGlobalVariations();
    } catch (error) {
      console.error('Erro ao excluir variação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a variação.",
        variant: "destructive"
      });
    }
  };

  const duplicateVariation = async (variation: GlobalVariation) => {
    try {
      const variationData = {
        user_id: user?.id,
        name: `${variation.name} (Cópia)`,
        description: variation.description,
        max_selections: variation.max_selections,
        required: variation.required,
        options: variation.options as any
      };

      const { error } = await supabase
        .from('global_variations')
        .insert(variationData);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Variação duplicada com sucesso!"
      });

      fetchGlobalVariations();
    } catch (error) {
      console.error('Erro ao duplicar variação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível duplicar a variação.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setNewVariation({
      name: '',
      description: '',
      max_selections: 1,
      required: false,
      options: [{ name: '', price: 0 }]
    });
    setEditingVariation(null);
    setIsCreateModalOpen(false);
  };

  const editVariation = (variation: GlobalVariation) => {
    setNewVariation({
      name: variation.name,
      description: variation.description || '',
      max_selections: variation.max_selections,
      required: variation.required,
      options: variation.options.length > 0 ? variation.options : [{ name: '', price: 0 }]
    });
    setEditingVariation(variation);
    setIsCreateModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Variações Globais</h2>
          <p className="text-muted-foreground">Gerencie variações que podem ser aplicadas a qualquer produto</p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus size={16} />
              Nova Variação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingVariation ? 'Editar Variação' : 'Nova Variação Global'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Variação</Label>
                  <Input
                    id="name"
                    value={newVariation.name}
                    onChange={(e) => setNewVariation(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Tamanho, Sabor, Adicional..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="max_selections">Máximo de Seleções</Label>
                  <Input
                    id="max_selections"
                    type="number"
                    min="1"
                    value={newVariation.max_selections}
                    onChange={(e) => setNewVariation(prev => ({ ...prev, max_selections: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (Opcional)</Label>
                <Textarea
                  id="description"
                  value={newVariation.description}
                  onChange={(e) => setNewVariation(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição da variação..."
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="required"
                  checked={newVariation.required}
                  onCheckedChange={(checked) => setNewVariation(prev => ({ ...prev, required: checked }))}
                />
                <Label htmlFor="required">Obrigatório</Label>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Opções</Label>
                  <Button variant="outline" size="sm" onClick={addOption}>
                    <Plus size={14} className="mr-1" />
                    Adicionar Opção
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {newVariation.options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Nome da opção"
                        value={option.name}
                        onChange={(e) => updateOption(index, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Preço adicional"
                        value={option.price}
                        onChange={(e) => updateOption(index, 'price', parseFloat(e.target.value) || 0)}
                        className="w-32"
                        step="0.01"
                        min="0"
                      />
                      {newVariation.options.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={saveVariation} className="flex-1">
                  {editingVariation ? 'Atualizar' : 'Criar'} Variação
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Variações */}
      <div className="grid gap-4">
        {globalVariations.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Tag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Nenhuma variação criada
              </h3>
              <p className="text-muted-foreground mb-4">
                Crie variações globais que podem ser aplicadas a qualquer produto
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus size={16} className="mr-2" />
                Criar Primeira Variação
              </Button>
            </CardContent>
          </Card>
        ) : (
          globalVariations.map((variation) => (
            <Card key={variation.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {variation.name}
                      {variation.required && (
                        <Badge variant="secondary">Obrigatório</Badge>
                      )}
                    </CardTitle>
                    {variation.description && (
                      <p className="text-sm text-muted-foreground mt-1">{variation.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => duplicateVariation(variation)}
                    >
                      <Copy size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editVariation(variation)}
                    >
                      <Edit size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteVariation(variation.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Máximo de seleções: {variation.max_selections}
                  </p>
                  <div>
                    <p className="text-sm font-medium mb-2">Opções:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {variation.options.map((option, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">{option.name}</span>
                          {option.price > 0 && (
                            <span className="text-sm text-green-600 font-medium">
                              +{option.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default GlobalVariationsManager;