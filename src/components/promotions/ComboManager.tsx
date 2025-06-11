
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Combo {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price: number;
  discount_percentage: number;
  active: boolean;
  image_url?: string;
  products: string[];
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

const ComboManager = () => {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    original_price: '',
    discount_percentage: '',
    active: true,
    image_url: '',
    products: [] as string[]
  });

  useEffect(() => {
    if (user) {
      fetchCombos();
      fetchProducts();
    }
  }, [user]);

  const fetchCombos = async () => {
    try {
      // Direct SQL query to fetch combos since types are not updated yet
      const { data, error } = await supabase
        .from('combos' as any)
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        // If combos table doesn't exist, log it and set empty array
        console.log('Combos table not available yet:', error);
        setCombos([]);
        return;
      }
      
      // Type assertion for the response with proper error handling
      setCombos((data || []) as Combo[]);
    } catch (error) {
      console.error('Erro ao carregar combos:', error);
      setCombos([]);
      toast({
        title: "Aviso",
        description: "A funcionalidade de combos ainda está sendo configurada.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('user_id', user?.id)
        .eq('available', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const comboData = {
        ...formData,
        price: parseFloat(formData.price),
        original_price: parseFloat(formData.original_price),
        discount_percentage: parseFloat(formData.discount_percentage),
        user_id: user?.id
      };

      if (editingCombo) {
        const { error } = await supabase
          .from('combos' as any)
          .update(comboData)
          .eq('id', editingCombo.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Combo atualizado com sucesso!"
        });
      } else {
        const { error } = await supabase
          .from('combos' as any)
          .insert([comboData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Combo criado com sucesso!"
        });
      }

      resetForm();
      fetchCombos();
    } catch (error) {
      console.error('Erro ao salvar combo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o combo. Verifique se a tabela de combos foi criada.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (combo: Combo) => {
    setEditingCombo(combo);
    setFormData({
      name: combo.name,
      description: combo.description,
      price: combo.price.toString(),
      original_price: combo.original_price.toString(),
      discount_percentage: combo.discount_percentage.toString(),
      active: combo.active,
      image_url: combo.image_url || '',
      products: combo.products
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este combo?')) return;

    try {
      const { error } = await supabase
        .from('combos' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Combo excluído com sucesso!"
      });

      fetchCombos();
    } catch (error) {
      console.error('Erro ao excluir combo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o combo.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      original_price: '',
      discount_percentage: '',
      active: true,
      image_url: '',
      products: []
    });
    setEditingCombo(null);
    setShowForm(false);
  };

  const toggleProductInCombo = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.includes(productId)
        ? prev.products.filter(id => id !== productId)
        : [...prev.products, productId]
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Combos e Promoções</h2>
          <p className="text-gray-600">Gerencie seus combos e ofertas especiais</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-2" />
          Novo Combo
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingCombo ? 'Editar Combo' : 'Novo Combo'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome do Combo</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="image_url">URL da Imagem</Label>
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="original_price">Preço Original</Label>
                  <Input
                    id="original_price"
                    type="number"
                    step="0.01"
                    value={formData.original_price}
                    onChange={(e) => setFormData({...formData, original_price: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="price">Preço do Combo</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="discount_percentage">Desconto (%)</Label>
                  <Input
                    id="discount_percentage"
                    type="number"
                    step="0.01"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({...formData, discount_percentage: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Produtos do Combo</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={product.id}
                        checked={formData.products.includes(product.id)}
                        onChange={() => toggleProductInCombo(product.id)}
                        className="rounded"
                      />
                      <label htmlFor={product.id} className="text-sm">
                        {product.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({...formData, active: checked})}
                />
                <Label>Combo Ativo</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingCombo ? 'Atualizar' : 'Criar'} Combo
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {combos.map((combo) => (
          <Card key={combo.id}>
            {combo.image_url && (
              <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                <img
                  src={combo.image_url}
                  alt={combo.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{combo.name}</CardTitle>
                <div className="flex gap-1">
                  {combo.active ? (
                    <Badge variant="default">Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">{combo.description}</p>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 line-through">
                    {formatCurrency(combo.original_price)}
                  </span>
                  <Badge variant="destructive">
                    -{combo.discount_percentage}%
                  </Badge>
                </div>
                <div className="text-xl font-bold text-primary">
                  {formatCurrency(combo.price)}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Package size={16} className="text-gray-500" />
                <span className="text-sm text-gray-600">
                  {combo.products.length} produtos
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(combo)}
                  className="flex-1"
                >
                  <Edit size={14} className="mr-1" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(combo.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {combos.length === 0 && (
        <div className="text-center py-12">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum combo criado
          </h3>
          <p className="text-gray-500 mb-4">
            Crie combos e promoções para aumentar suas vendas.
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} className="mr-2" />
            Criar Primeiro Combo
          </Button>
        </div>
      )}
    </div>
  );
};

export default ComboManager;
