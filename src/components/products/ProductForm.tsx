
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id?: string;
  name: string;
  description?: string;
  price: number;
  category_id?: string;
  image_url?: string;
  available: boolean;
  weight_based?: boolean;
  available_delivery?: boolean;
  available_pdv?: boolean;
  send_to_kds?: boolean;
}

interface ProductFormProps {
  product?: Product | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<Product>({
    name: '',
    description: '',
    price: 0,
    category_id: '',
    image_url: '',
    available: true,
    weight_based: false,
    available_delivery: true,
    available_pdv: true,
    send_to_kds: false,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchCategories();
    if (product) {
      setFormData({
        ...product,
        available_delivery: product.available_delivery ?? true,
        available_pdv: product.available_pdv ?? true,
        send_to_kds: product.send_to_kds ?? false,
      });
    }
  }, [product]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('user_id', user?.id)
        .eq('active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.price) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e preço são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const productData = {
        ...formData,
        user_id: user?.id,
        category: formData.category_id ? categories.find(c => c.id === formData.category_id)?.name || '' : '',
      };

      if (product?.id) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);
        if (error) throw error;
      }

      toast({
        title: product?.id ? 'Produto atualizado' : 'Produto criado',
        description: 'O produto foi salvo com sucesso.',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar produto',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{product?.id ? 'Editar Produto' : 'Novo Produto'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="price">Preço *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select 
                value={formData.category_id} 
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="image_url">URL da Imagem</Label>
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Configurações de Venda</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="available_delivery"
                  checked={formData.available_delivery}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, available_delivery: !!checked })
                  }
                />
                <Label htmlFor="available_delivery">Disponível no Delivery</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="available_pdv"
                  checked={formData.available_pdv}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, available_pdv: !!checked })
                  }
                />
                <Label htmlFor="available_pdv">Disponível no PDV</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_to_kds"
                  checked={formData.send_to_kds}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, send_to_kds: !!checked })
                  }
                />
                <Label htmlFor="send_to_kds">Enviar para Cozinha (KDS)</Label>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.available}
                onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
              />
              <Label>Produto disponível</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.weight_based}
                onCheckedChange={(checked) => setFormData({ ...formData, weight_based: checked })}
              />
              <Label>Vendido por peso (kg)</Label>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : (product?.id ? 'Atualizar' : 'Criar')}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProductForm;
