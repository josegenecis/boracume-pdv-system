import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, ToggleLeft, ToggleRight, Search, Package } from 'lucide-react';

interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  is_active: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'Proteínas',
  'Laticínios', 
  'Verduras',
  'Grãos',
  'Temperos',
  'Frutas',
  'Bebidas',
  'Outros'
];

const UNITS = [
  'kg',
  'g',
  'l',
  'ml',
  'unidade',
  'dúzia',
  'caixa',
  'pacote'
];

export default function Ingredientes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  
  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: '',
    price: 0,
    is_active: true
  });

  useEffect(() => {
    if (user) {
      loadIngredients();
    }
  }, [user]);

  useEffect(() => {
    filterIngredients();
  }, [ingredients, searchTerm, selectedCategory, showInactive]);

  const loadIngredients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setIngredients(data || []);
    } catch (error) {
      console.error('Error loading ingredients:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os ingredientes.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filterIngredients = () => {
    let filtered = ingredients;

    if (searchTerm) {
      filtered = filtered.filter(ing => 
        ing.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(ing => ing.category === selectedCategory);
    }

    if (!showInactive) {
      filtered = filtered.filter(ing => ing.is_active);
    }

    setFilteredIngredients(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingIngredient) {
        // Update existing ingredient
        const { error } = await supabase
          .from('ingredients')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingIngredient.id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Ingrediente atualizado com sucesso.'
        });
      } else {
        // Create new ingredient
        const { error } = await supabase
          .from('ingredients')
          .insert({
            ...formData,
            user_id: user.id
          });

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Ingrediente cadastrado com sucesso.'
        });
      }

      setIsFormOpen(false);
      resetForm();
      loadIngredients();
    } catch (error) {
      console.error('Error saving ingredient:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o ingrediente.',
        variant: 'destructive'
      });
    }
  };

  const handleToggleStatus = async (ingredient: Ingredient) => {
    try {
      const { error } = await supabase
        .from('ingredients')
        .update({ 
          is_active: !ingredient.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', ingredient.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Ingrediente ${!ingredient.is_active ? 'ativado' : 'desativado'} com sucesso.`
      });

      loadIngredients();
    } catch (error) {
      console.error('Error toggling ingredient status:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status do ingrediente.',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setFormData({
      name: ingredient.name,
      category: ingredient.category,
      unit: ingredient.unit,
      price: ingredient.price,
      is_active: ingredient.is_active
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
      category: '',
      unit: '',
      price: 0,
      is_active: true
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
              <Label htmlFor="category">Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Todas categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas categorias</SelectItem>
                  {CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <Label htmlFor="show-inactive">Mostrar inativos</Label>
              </div>
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
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIngredients.map((ingredient) => (
                    <TableRow key={ingredient.id}>
                      <TableCell className="font-medium">{ingredient.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ingredient.category}</Badge>
                      </TableCell>
                      <TableCell>{ingredient.unit}</TableCell>
                      <TableCell>{formatCurrency(ingredient.price)}</TableCell>
                      <TableCell>
                        <Badge variant={ingredient.is_active ? "default" : "secondary"}>
                          {ingredient.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(ingredient.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(ingredient)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(ingredient)}
                          >
                            {ingredient.is_active ? (
                              <ToggleLeft className="h-4 w-4 text-orange-500" />
                            ) : (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
                {editingIngredient ? 'Editar Ingrediente' : 'Novo Ingrediente'}
              </DialogTitle>
              <DialogDescription>
                {editingIngredient 
                  ? 'Edite as informações do ingrediente abaixo.' 
                  : 'Preencha as informações do novo ingrediente abaixo.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Carne de Sol"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  required
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="unit">Unidade de Medida *</Label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                  required
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Selecione uma unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(unit => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="price">Preço Unitário (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  placeholder="0,00"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Ativo</Label>
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
              <Button type="submit">
                {editingIngredient ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}