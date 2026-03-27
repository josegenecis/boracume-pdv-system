import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Search, Package } from 'lucide-react';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  price: number;
  current_stock: number;
  min_stock: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const UNITS = [
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'l', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'un', label: 'Unidade (un)' }
];

export default function Ingredientes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState('all'); // all, low_stock
  
  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    unit: 'un',
    cost_price: 0,
    current_stock: 0,
    min_stock: 0
  });

  useEffect(() => {
    if (user) {
      loadIngredients();
    }
  }, [user]);

  const filterIngredients = () => {
    let filtered = ingredients;

    if (searchTerm) {
      filtered = filtered.filter(ing => 
        ing.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStockStatus === 'low_stock') {
      filtered = filtered.filter(ing => (ing.current_stock || 0) <= (ing.min_stock || 0));
    }

    setFilteredIngredients(filtered);
  };

  useEffect(() => {
    filterIngredients();
  }, [searchTerm, filterStockStatus, ingredients]);

  const loadIngredients = async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
        
      if (error) throw error;
      setIngredients(data || []);
      setFilteredIngredients(data || []);
    } catch (error) {
      console.error('Error loading ingredients:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os insumos.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user) return;

      const payload = {
        name: formData.name,
        unit: formData.unit,
        price: Number(formData.cost_price || 0),
        current_stock: Number(formData.current_stock || 0),
        min_stock: Number(formData.min_stock || 0),
        user_id: user.id
      };

      if (editingIngredient) {
        const { error } = await supabase
          .from('ingredients')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingIngredient.id);
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Insumo atualizado com sucesso.' });
      } else {
        const { error } = await supabase
          .from('ingredients')
          .insert([payload]);
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Insumo cadastrado com sucesso.' });
      }

      setIsFormOpen(false);
      loadIngredients();
    } catch (error: any) {
      console.error('Error saving ingredient:', error);
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível salvar o insumo.',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setFormData({
      name: ingredient.name,
      unit: ingredient.unit,
      cost_price: ingredient.price,
      current_stock: ingredient.current_stock || 0,
      min_stock: ingredient.min_stock || 0
    });
    setIsFormOpen(true);
  };

  const handleNewIngredient = () => {
    setEditingIngredient(null);
    resetForm();
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      unit: 'un',
      cost_price: 0,
      current_stock: 0,
      min_stock: 0
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controle de Ingredientes</h1>
          <p className="text-muted-foreground">
            Gerencie os ingredientes utilizados em seus produtos
          </p>
        </div>
        <Button onClick={handleNewIngredient}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Ingrediente
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Nome do ingrediente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock_status">Status do Estoque</Label>
              <Select value={filterStockStatus} onValueChange={setFilterStockStatus}>
                <SelectTrigger id="stock_status">
                  <SelectValue placeholder="Todos os insumos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os insumos</SelectItem>
                  <SelectItem value="low_stock">Estoque Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ingredientes ({filteredIngredients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredIngredients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum ingrediente encontrado</p>
              <p className="text-sm mt-1">Tente ajustar os filtros ou cadastrar um novo ingrediente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Estoque Atual</TableHead>
                    <TableHead>Estoque Mínimo</TableHead>
                    <TableHead>Preço de Custo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIngredients.map((ingredient) => {
                    const isLowStock = (ingredient.current_stock || 0) <= (ingredient.min_stock || 0);
                    return (
                      <TableRow key={ingredient.id}>
                        <TableCell className="font-medium">{ingredient.name}</TableCell>
                        <TableCell>{UNITS.find(u => u.value === ingredient.unit)?.label || ingredient.unit}</TableCell>
                        <TableCell>
                          <Badge variant={isLowStock ? "destructive" : "secondary"} className={isLowStock ? "bg-red-500" : "bg-boracume-green text-white"}>
                            {ingredient.current_stock || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>{ingredient.min_stock || 0}</TableCell>
                        <TableCell>{formatCurrency(ingredient.price)}</TableCell>
                        <TableCell>
                          {isLowStock ? (
                            <span className="text-red-500 font-semibold text-xs flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                              Baixo
                            </span>
                          ) : (
                            <span className="text-boracume-green font-semibold text-xs">Normal</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(ingredient)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingIngredient ? 'Editar Insumo' : 'Novo Insumo'}
              </DialogTitle>
              <DialogDescription>
                {editingIngredient 
                  ? 'Edite as informações do insumo para a Ficha Técnica.' 
                  : 'Cadastre um novo insumo para controle de estoque e custos.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Insumo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Queijo Muçarela, Tomate"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="unit">Unidade de Medida *</Label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                  required
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(unit => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Ex: Compre em KG, mas coloque em Gramas (g) se a receita usar gramas.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="current_stock">Estoque Atual</Label>
                    <Input
                      id="current_stock"
                      type="number"
                      step="0.001"
                      min="0"
                      value={formData.current_stock === 0 ? '' : formData.current_stock}
                      onChange={(e) => setFormData(prev => ({ ...prev, current_stock: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="min_stock">Estoque Mínimo</Label>
                    <Input
                      id="min_stock"
                      type="number"
                      step="0.001"
                      min="0"
                      value={formData.min_stock === 0 ? '' : formData.min_stock}
                      onChange={(e) => setFormData(prev => ({ ...prev, min_stock: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                    />
                  </div>
                </div>

              <div className="grid gap-2">
                <Label htmlFor="cost_price">Preço de Custo (Por unidade escolhida acima) *</Label>
                <Input
                  id="cost_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_price === 0 ? '' : formData.cost_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost_price: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-boracume-green hover:bg-boracume-green/90">
                {editingIngredient ? 'Salvar Alterações' : 'Cadastrar Insumo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}