
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, FolderPlus, GripVertical, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { supabase } from '@/integrations/supabase/client';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { buildCategoryDescriptionWithMetadata, enrichCategoryWithMetadata } from '@/lib/category-metadata';

interface Category {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  active: boolean;
  is_pizza: boolean;
  pizza_half_price_mode: 'highest' | 'split_halves';
}

const CategoryManager = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    display_order: 0,
    active: true,
    is_pizza: false,
    pizza_half_price_mode: 'highest' as 'highest' | 'split_halves',
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const confirm = useConfirmDialog();

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user]);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('user_id', user?.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(((data || []) as Category[]).map((category: any) => enrichCategoryWithMetadata(category)));
      setSelectedIds((prev) => {
        const ids = new Set((data || []).map((c: Category) => c.id));
        return new Set(Array.from(prev).filter((id) => ids.has(id)));
      });
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as categorias.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !formData.name.trim()) return;

    try {
      setIsLoading(true);
      
      if (editingCategory) {
        const { error } = await supabase
          .from('product_categories')
          .update({
            name: formData.name,
            description: buildCategoryDescriptionWithMetadata(formData.description || '', {
              is_pizza: formData.is_pizza,
              pizza_half_price_mode: formData.pizza_half_price_mode
            }),
            display_order: formData.display_order,
            active: formData.active
          })
          .eq('id', editingCategory.id);
        
        if (error) throw error;
        
        toast({
          title: 'Categoria atualizada',
          description: 'A categoria foi atualizada com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('product_categories')
          .insert({
            user_id: user.id,
            name: formData.name,
            description: buildCategoryDescriptionWithMetadata(formData.description || '', {
              is_pizza: formData.is_pizza,
              pizza_half_price_mode: formData.pizza_half_price_mode
            }),
            display_order: formData.display_order,
            active: formData.active
          });
        
        if (error) throw error;
        
        toast({
          title: 'Categoria criada',
          description: 'A nova categoria foi criada com sucesso.',
        });
      }
      
      setFormData({ name: '', description: '', display_order: 0, active: true, is_pizza: false, pizza_half_price_mode: 'highest' });
      setEditingCategory(null);
      setIsDialogOpen(false);
      fetchCategories();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar categoria',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      display_order: category.display_order,
      active: category.active,
      is_pizza: Boolean(category.is_pizza),
      pizza_half_price_mode: category.pizza_half_price_mode === 'split_halves' ? 'split_halves' : 'highest'
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (categoryId: string) => {
    const ok = await confirm({
      title: 'Excluir categoria',
      description: 'Tem certeza que deseja excluir esta categoria?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', categoryId);
      
      if (error) throw error;
      
      toast({
        title: 'Categoria excluída',
        description: 'A categoria foi excluída com sucesso.',
      });
      
      fetchCategories();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir categoria',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategoryActive = async (category: Category) => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('product_categories')
        .update({ active: !category.active })
        .eq('id', category.id);
      if (error) throw error;
      toast({ title: 'Categoria atualizada', description: `Categoria ${category.active ? 'ocultada' : 'ativada'} com sucesso.` });
      fetchCategories();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar categoria', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(categories.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const bulkDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: 'Excluir categorias',
      description: `Tem certeza que deseja excluir ${selectedIds.size} categoria(s)?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      setIsLoading(true);
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .in('id', ids);

      if (error) throw error;

      toast({
        title: 'Categorias excluídas',
        description: `${ids.length} categoria(s) excluída(s) com sucesso.`,
      });

      clearSelection();
      fetchCategories();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir categorias',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', display_order: 0, active: true, is_pizza: false, pizza_half_price_mode: 'highest' });
    setEditingCategory(null);
  };

  const persistOrder = async (next: Category[]) => {
    try {
      await Promise.all(
        next.map((c, idx) =>
          supabase
            .from('product_categories')
            .update({ display_order: idx })
            .eq('id', c.id)
        )
      );
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao salvar ordem', variant: 'destructive' });
      fetchCategories();
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    const next = Array.from(categories);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setCategories(next.map((c, idx) => ({ ...c, display_order: idx })));
    persistOrder(next);
  };

  return (
    <Card className="overflow-hidden rounded-[30px] border border-orange-200/70 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/70 shadow-[0_24px_60px_-40px_rgba(249,115,22,0.45)]">
      <CardHeader className="border-b border-orange-100/80 bg-white/65 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1 text-xs font-semibold text-boracume-orange">
              <Sparkles className="h-3.5 w-3.5" />
              Categorias com toque de vidro
            </div>
            <CardTitle className="mt-2 flex items-center gap-2 text-slate-900">
            <FolderPlus className="h-5 w-5" />
            Categorias de Produtos
            </CardTitle>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="rounded-2xl bg-boracume-orange text-white hover:bg-orange-600 shadow-[0_18px_35px_-20px_rgba(249,115,22,0.8)]">
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[28px] border border-orange-200/70 bg-gradient-to-br from-orange-50/95 via-white to-amber-50/95 shadow-[0_28px_70px_-35px_rgba(249,115,22,0.45)]">
              <DialogHeader>
                <DialogTitle className="text-slate-900">
                  {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="font-semibold text-boracume-dark-green">Nome da Categoria *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Hambúrgueres, Pizzas..."
                    className="mt-2 rounded-2xl border-orange-200/80 bg-white/80 backdrop-blur-md shadow-[0_10px_30px_-18px_rgba(249,115,22,0.5)]"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="font-semibold text-boracume-dark-green">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional da categoria"
                    rows={3}
                    className="mt-2 rounded-2xl border-orange-200/80 bg-white/80 backdrop-blur-md shadow-[0_10px_30px_-18px_rgba(249,115,22,0.5)]"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="display_order" className="font-semibold text-boracume-dark-green">Ordem de Exibição</Label>
                    <Input
                      id="display_order"
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      className="mt-2 rounded-2xl border-orange-200/80 bg-white/80 backdrop-blur-md shadow-[0_10px_30px_-18px_rgba(249,115,22,0.5)]"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className={formData.active ? 'w-full rounded-2xl border-boracume-orange bg-boracume-orange text-white hover:bg-orange-600' : 'w-full rounded-2xl border-orange-200 bg-white/80 text-boracume-orange hover:bg-orange-50'}
                      onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
                    >
                      {formData.active ? 'Categoria ativa' : 'Categoria oculta'}
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-orange-200/80 bg-white/80 p-4 shadow-[0_10px_30px_-18px_rgba(249,115,22,0.5)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="font-semibold text-boracume-dark-green">Categoria de pizza</Label>
                      <p className="mt-1 text-xs text-[#003223]/65">Ative para usar 1 sabor ou 2 metades com regra automÃ¡tica de preÃ§o.</p>
                    </div>
                    <Switch
                      checked={formData.is_pizza}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_pizza: checked }))}
                    />
                  </div>
                  {formData.is_pizza && (
                    <div className="mt-4">
                      <Label className="font-semibold text-boracume-dark-green">Regra do meio a meio</Label>
                      <Select
                        value={formData.pizza_half_price_mode}
                        onValueChange={(value: 'highest' | 'split_halves') => setFormData((prev) => ({ ...prev, pizza_half_price_mode: value }))}
                      >
                        <SelectTrigger className="mt-2 rounded-2xl border-orange-200/80 bg-white/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="highest">Prevalece o sabor de maior valor</SelectItem>
                          <SelectItem value="split_halves">Soma metade de cada sabor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="rounded-2xl border-orange-200 bg-white/80 text-boracume-orange hover:bg-orange-50"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={isLoading || !formData.name.trim()}
                    className="rounded-2xl bg-boracume-orange text-white hover:bg-orange-600"
                  >
                    {isLoading ? 'Salvando...' : (editingCategory ? 'Atualizar' : 'Criar')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl border-orange-200 bg-white/80 text-boracume-orange hover:bg-orange-50"
              onClick={() => {
                if (selectedIds.size === categories.length) clearSelection();
                else selectAll();
              }}
            >
              {selectedIds.size === categories.length ? 'Desmarcar todas' : 'Selecionar todas'}
            </Button>
            {selectedIds.size > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Limpar seleção
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    void bulkDeleteSelected();
                  }}
                  disabled={isLoading}
                >
                  Excluir selecionadas ({selectedIds.size})
                </Button>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma categoria cadastrada ainda.</p>
            <p className="text-sm">Crie categorias para organizar seus produtos.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      selectedIds.size === 0
                        ? false
                        : selectedIds.size === categories.length
                          ? true
                          : 'indeterminate'
                    }
                    onCheckedChange={(v) => {
                      const next = v === true;
                      if (next) selectAll();
                      else clearSelection();
                    }}
                    aria-label="Selecionar todas as categorias"
                  />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="categories">
                {(droppableProvided) => (
                  <TableBody ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
                    {categories.map((category, index) => (
                      <Draggable key={category.id} draggableId={category.id} index={index}>
                        {(draggableProvided) => (
                          <TableRow ref={draggableProvided.innerRef} {...draggableProvided.draggableProps}>
                            <TableCell className="w-10">
                              <Checkbox
                                checked={selectedIds.has(category.id)}
                                onCheckedChange={(v) => toggleSelect(category.id, v === true)}
                                aria-label={`Selecionar categoria ${category.name}`}
                              />
                            </TableCell>
                            <TableCell className="w-10">
                              <button type="button" {...draggableProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-muted-foreground">
                                <GripVertical className="h-4 w-4" />
                              </button>
                            </TableCell>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell>{category.description || '-'}</TableCell>
                            <TableCell>
                              {category.is_pizza ? (
                                <div className="space-y-1">
                                  <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">Pizza</span>
                                  <div className="text-[11px] text-[#003223]/60">
                                    {category.pizza_half_price_mode === 'split_halves' ? 'Metade de cada sabor' : 'Maior sabor'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-[#003223]/60">PadrÃ£o</span>
                              )}
                            </TableCell>
                            <TableCell>{category.display_order}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${category.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {category.active ? 'Ativa' : 'Inativa'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-2xl border-orange-200 bg-white/80 text-boracume-orange hover:bg-orange-50"
                                  onClick={() => toggleCategoryActive(category)}
                                >
                                  {category.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-2xl border-orange-200 bg-white/80 text-boracume-orange hover:bg-orange-50"
                                  onClick={() => handleEdit(category)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-2xl border-red-200 bg-white/80 text-red-500 hover:bg-red-50"
                                  onClick={() => handleDelete(category.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Draggable>
                    ))}
                    {droppableProvided.placeholder}
                  </TableBody>
                )}
              </Droppable>
            </DragDropContext>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default CategoryManager;
