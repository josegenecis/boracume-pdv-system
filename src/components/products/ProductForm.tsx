
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ProductImageUpload from './ProductImageUpload';

interface Product {
  id?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  category_id?: string;
  image_url?: string;
  available: boolean;
  weight_based: boolean;
  send_to_kds: boolean;
  show_in_pdv: boolean;
  show_in_delivery: boolean;
}

interface ProductFormProps {
  product?: Product;
  onSubmit: (product: Product) => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Product>({
    name: '',
    description: '',
    price: 0,
    category: '',
    image_url: '',
    available: true,
    weight_based: false,
    send_to_kds: false,
    show_in_pdv: true,
    show_in_delivery: true,
    ...product
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('user_id', user?.id)
        .eq('active', true);

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category || formData.price <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      const productData = {
        ...formData,
        user_id: user?.id,
        updated_at: new Date().toISOString()
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
        title: "Sucesso",
        description: `Produto ${product?.id ? 'atualizado' : 'criado'} com sucesso!`,
      });

      onSubmit(formData);
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar produto.",
        variant: "destructive"
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
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preço *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => {
                const category = categories.find((cat: any) => cat.name === value);
                setFormData(prev => ({ 
                  ...prev, 
                  category: value,
                  category_id: category?.id
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category: any) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <ProductImageUpload
            onImageUploaded={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
            currentImageUrl={formData.image_url}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="available"
                checked={formData.available}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, available: checked }))}
              />
              <Label htmlFor="available">Disponível</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="weight_based"
                checked={formData.weight_based}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, weight_based: checked }))}
              />
              <Label htmlFor="weight_based">Vendido por peso</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="send_to_kds"
                checked={formData.send_to_kds}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, send_to_kds: checked }))}
              />
              <Label htmlFor="send_to_kds">Enviar para cozinha</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="show_in_pdv"
                checked={formData.show_in_pdv}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_in_pdv: checked }))}
              />
              <Label htmlFor="show_in_pdv">Mostrar no PDV</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="show_in_delivery"
                checked={formData.show_in_delivery}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_in_delivery: checked }))}
              />
              <Label htmlFor="show_in_delivery">Mostrar no delivery</Label>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Produto'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProductForm;
