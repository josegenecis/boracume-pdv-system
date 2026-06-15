import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Search, Package, ShoppingBag, ArrowDownToLine } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useNavigate } from 'react-router-dom';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  price: number;
  cost_price?: number;
  current_stock: number;
  min_stock: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface ProductStock {
  id: string;
  name: string;
  category?: string | null;
  price: number;
  track_stock: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  available?: boolean | null;
  show_in_delivery?: boolean | null;
  updated_at?: string | null;
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
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState('all'); // all, low_stock
  
  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [stockEntryOpen, setStockEntryOpen] = useState(false);
  const [stockEntryTarget, setStockEntryTarget] = useState<{ type: 'product' | 'ingredient'; id: string; name: string } | null>(null);
  const [stockEntryQuantity, setStockEntryQuantity] = useState('');
  const [stockEntryCost, setStockEntryCost] = useState(0);
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
    let filteredProductRows = products;

    if (searchTerm) {
      filtered = filtered.filter(ing => 
        ing.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      filteredProductRows = filteredProductRows.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(product.category || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStockStatus === 'low_stock') {
      filtered = filtered.filter(ing => (ing.current_stock || 0) <= (ing.min_stock || 0));
      filteredProductRows = filteredProductRows.filter(product =>
        product.track_stock && (product.stock_quantity || 0) <= (product.low_stock_threshold || 0)
      );
    } else if (filterStockStatus === 'controlled') {
      filteredProductRows = filteredProductRows.filter(product => product.track_stock);
    } else if (filterStockStatus === 'out') {
      filteredProductRows = filteredProductRows.filter(product => product.track_stock && (product.stock_quantity || 0) <= 0);
    }

    setFilteredIngredients(filtered);
    setFilteredProducts(filteredProductRows);
  };

  useEffect(() => {
    filterIngredients();
  }, [searchTerm, filterStockStatus, ingredients, products]);

  const normalizeIngredient = (ingredient: any): Ingredient => ({
    ...ingredient,
    price: Number(ingredient?.price ?? ingredient?.cost_price ?? 0),
    cost_price: Number(ingredient?.cost_price ?? ingredient?.price ?? 0),
    current_stock: Number(ingredient?.current_stock ?? 0),
    min_stock: Number(ingredient?.min_stock ?? 0),
  });

  const normalizeProductStock = (product: any): ProductStock => ({
    ...product,
    price: Number(product?.price ?? 0),
    track_stock: Boolean(product?.track_stock),
    stock_quantity: Number(product?.stock_quantity ?? 0),
    low_stock_threshold: Number(product?.low_stock_threshold ?? 0),
  });

  const buildIngredientPayloadVariants = () => {
    const base = {
      name: formData.name,
      unit: formData.unit,
      user_id: user?.id,
    };

    return [
      {
        ...base,
        current_stock: Number(formData.current_stock || 0),
        min_stock: Number(formData.min_stock || 0),
        cost_price: Number(formData.cost_price || 0),
      },
      {
        ...base,
        current_stock: Number(formData.current_stock || 0),
        min_stock: Number(formData.min_stock || 0),
        price: Number(formData.cost_price || 0),
      },
      {
        ...base,
        category: 'Insumos',
        is_active: true,
        price: Number(formData.cost_price || 0),
      },
      {
        ...base,
        category: 'Insumos',
        is_active: true,
        current_stock: Number(formData.current_stock || 0),
        min_stock: Number(formData.min_stock || 0),
        price: Number(formData.cost_price || 0),
      },
    ];
  };

  const persistIngredient = async () => {
    const payloadVariants = buildIngredientPayloadVariants();
    let lastError: any = null;

    for (const payload of payloadVariants) {
      if (editingIngredient) {
        const { error } = await (supabase.from('ingredients') as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingIngredient.id);

        if (!error) {
          return;
        }

        lastError = error;
        continue;
      }

      const { error } = await (supabase.from('ingredients') as any)
        .insert([payload]);

      if (!error) {
        return;
      }

      lastError = error;
    }

    throw lastError;
  };

  const loadIngredients = async () => {
    try {
      if (!user) return;
      const [{ data, error }, productsResult] = await Promise.all([
        supabase
          .from('ingredients')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),
        (supabase as any)
          .from('products')
          .select('id,name,category,price,track_stock,stock_quantity,low_stock_threshold,available,show_in_delivery,updated_at')
          .eq('user_id', user.id)
          .order('name')
      ]);
        
      if (error) throw error;
      if (productsResult.error) throw productsResult.error;
      const normalizedIngredients = (data || []).map(normalizeIngredient);
      const normalizedProducts = (productsResult.data || []).map(normalizeProductStock);
      setIngredients(normalizedIngredients);
      setFilteredIngredients(normalizedIngredients);
      setProducts(normalizedProducts);
      setFilteredProducts(normalizedProducts);
    } catch (error) {
      console.error('Error loading ingredients:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o estoque.',
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

      await persistIngredient();

      if (editingIngredient) {
        toast({ title: 'Sucesso', description: 'Insumo atualizado com sucesso.' });
      } else {
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

  const openStockEntry = (target: { type: 'product' | 'ingredient'; id: string; name: string }) => {
    setStockEntryTarget(target);
    setStockEntryQuantity('');
    setStockEntryCost(0);
    setStockEntryOpen(true);
  };

  const handleStockEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !stockEntryTarget) return;

    const quantity = Number(String(stockEntryQuantity || '').replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (stockEntryTarget.type === 'product') {
        const current = products.find((product) => product.id === stockEntryTarget.id);
        const nextQuantity = Math.max(0, Number(current?.stock_quantity || 0)) + Math.trunc(quantity);

        const { error: productError } = await (supabase as any)
          .from('products')
          .update({
            track_stock: true,
            stock_quantity: nextQuantity,
            available: true,
            is_available: true,
            show_in_delivery: current?.show_in_delivery ?? true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', stockEntryTarget.id)
          .eq('user_id', user.id);

        if (productError) throw productError;

        await (supabase as any).from('inventory_movements').insert({
          user_id: user.id,
          product_id: stockEntryTarget.id,
          type: 'purchase',
          quantity: Math.trunc(quantity),
        });
      } else {
        const current = ingredients.find((ingredient) => ingredient.id === stockEntryTarget.id);
        const nextQuantity = Number(current?.current_stock || 0) + quantity;

        const { error: ingredientError } = await (supabase as any)
          .from('ingredients')
          .update({
            current_stock: nextQuantity,
            cost_price: stockEntryCost > 0 ? Number(stockEntryCost) : current?.cost_price ?? current?.price ?? 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', stockEntryTarget.id)
          .eq('user_id', user.id);

        if (ingredientError) throw ingredientError;

        await (supabase as any).from('stock_movements').insert({
          user_id: user.id,
          ingredient_id: stockEntryTarget.id,
          movement_type: 'in',
          quantity,
          unit_cost: stockEntryCost > 0 ? Number(stockEntryCost) : current?.cost_price ?? current?.price ?? 0,
          reason: 'Entrada manual pelo estoque',
        });
      }

      toast({
        title: 'Estoque atualizado',
        description: `${stockEntryTarget.name} recebeu entrada de estoque.`,
      });
      setStockEntryOpen(false);
      setStockEntryTarget(null);
      await loadIngredients();
    } catch (error: any) {
      toast({
        title: 'Erro ao lançar estoque',
        description: error?.message || 'Não foi possível somar essa entrada no estoque.',
        variant: 'destructive',
      });
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Controle de Estoque</h1>
          <p className="text-muted-foreground">
            Veja produtos do PDV e insumos usados na ficha técnica
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/produtos?new=1')}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            Novo produto
          </Button>
          <Button onClick={handleNewIngredient}>
            <Plus className="h-4 w-4 mr-2" />
            Novo insumo
          </Button>
        </div>
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
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="controlled">Produtos com controle</SelectItem>
                  <SelectItem value="low_stock">Estoque Baixo</SelectItem>
                  <SelectItem value="out">Sem estoque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Produtos ({filteredProducts.length})</TabsTrigger>
          <TabsTrigger value="ingredients">Insumos ({filteredIngredients.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Estoque de produtos
              </CardTitle>
              <CardDescription>
                Produtos com controle ativo baixam automaticamente quando a venda é finalizada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum produto encontrado</p>
                  <p className="text-sm mt-1">Cadastre produtos ou ative o controle de estoque no cadastro do produto.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Estoque Atual</TableHead>
                        <TableHead>Estoque Mínimo</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => {
                        const isControlled = product.track_stock;
                        const isLowStock = isControlled && product.stock_quantity <= product.low_stock_threshold;
                        const isOut = isControlled && product.stock_quantity <= 0;
                        return (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.category || 'Sem categoria'}</TableCell>
                            <TableCell>
                              <Badge
                                variant={isLowStock ? 'destructive' : 'secondary'}
                                className={!isControlled ? 'bg-slate-100 text-slate-600' : isLowStock ? 'bg-red-500' : 'bg-boracume-green text-white'}
                              >
                                {isControlled ? product.stock_quantity : 'Não controla'}
                              </Badge>
                            </TableCell>
                            <TableCell>{isControlled ? product.low_stock_threshold : '-'}</TableCell>
                            <TableCell>{formatCurrency(product.price)}</TableCell>
                            <TableCell>
                              {isOut ? (
                                <span className="text-red-600 font-semibold text-xs">Sem estoque</span>
                              ) : isLowStock ? (
                                <span className="text-red-500 font-semibold text-xs flex items-center gap-1">
                                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                                  Baixo
                                </span>
                              ) : isControlled ? (
                                <span className="text-boracume-green font-semibold text-xs">Normal</span>
                              ) : (
                                <span className="text-slate-500 font-semibold text-xs">Sem controle</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openStockEntry({ type: 'product', id: product.id, name: product.name })}>
                                  <ArrowDownToLine className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => navigate('/produtos')}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
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
        </TabsContent>

        <TabsContent value="ingredients">
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
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openStockEntry({ type: 'ingredient', id: ingredient.id, name: ingredient.name })}
                                >
                                  <ArrowDownToLine className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(ingredient)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
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
        </TabsContent>
      </Tabs>

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
                <CurrencyInput
                  id="cost_price"
                  value={formData.cost_price || 0}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, cost_price: value }))}
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

      <Dialog open={stockEntryOpen} onOpenChange={setStockEntryOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <form onSubmit={handleStockEntry}>
            <DialogHeader>
              <DialogTitle>Entrada de estoque</DialogTitle>
              <DialogDescription>
                Some uma compra ou reposição ao estoque de {stockEntryTarget?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="stock_entry_quantity">Quantidade que entrou *</Label>
                <Input
                  id="stock_entry_quantity"
                  type="number"
                  step={stockEntryTarget?.type === 'product' ? '1' : '0.001'}
                  min="0"
                  value={stockEntryQuantity}
                  onChange={(event) => setStockEntryQuantity(event.target.value)}
                  placeholder={stockEntryTarget?.type === 'product' ? 'Ex: 12' : 'Ex: 2.5'}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Produto acabado usa unidade inteira. Insumo usa a unidade cadastrada nele.
                </p>
              </div>

              {stockEntryTarget?.type === 'ingredient' ? (
                <div className="grid gap-2">
                  <Label htmlFor="stock_entry_cost">Custo por unidade</Label>
                  <CurrencyInput
                    id="stock_entry_cost"
                    value={stockEntryCost}
                    onValueChange={setStockEntryCost}
                    placeholder="0,00"
                  />
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStockEntryOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-boracume-green hover:bg-boracume-green/90">
                Somar no estoque
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
