
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ProductImageUpload from './ProductImageUpload';

// Defining the interface here to ensure consistency
interface ProductItem {
  id?: string;
  name: string;
  description?: string; 
  price: number;
  category: string;
  category_id?: string;
  image_url?: string;
  available: boolean;
  weight_based: boolean; // Ensuring this is not optional
  send_to_kds: boolean;
  show_in_pdv: boolean;
  show_in_delivery: boolean;
}

interface ProductFormProps {
  product?: ProductItem;
  onSave: () => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSave, onCancel }) => {
  const [formData, setFormData] = useState<ProductItem>({
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
  const [globalVariations, setGlobalVariations] = useState([]);
  const [selectedVariations, setSelectedVariations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadCategories();
    loadGlobalVariations();
    if (product?.id) {
      loadProductVariations(product.id);
    }
  }, [product?.id]);

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

  const loadGlobalVariations = async () => {
    try {
      const { data, error } = await supabase
        .from('global_variations')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setGlobalVariations(data || []);
    } catch (error) {
      console.error('Erro ao carregar variações globais:', error);
    }
  };

  const loadProductVariations = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id')
        .eq('product_id', productId);

      if (error) throw error;
      setSelectedVariations(data?.map(link => link.global_variation_id) || []);
    } catch (error) {
      console.error('Erro ao carregar variações do produto:', error);
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

      let productId = product?.id;

      if (product?.id) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select('id')
          .single();

        if (error) throw error;
        productId = data.id;
      }

      // Salvar variações globais selecionadas
      await saveProductVariations(productId!);

      toast({
        title: "Sucesso",
        description: `Produto ${product?.id ? 'atualizado' : 'criado'} com sucesso!`,
      });

      onSave(); // Call the simplified callback
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

  const saveProductVariations = async (productId: string) => {
    try {
      // Remover vínculos existentes
      await supabase
        .from('product_global_variation_links')
        .delete()
        .eq('product_id', productId);

      // Adicionar novos vínculos
      if (selectedVariations.length > 0) {
        const links = selectedVariations.map(variationId => ({
          product_id: productId,
          global_variation_id: variationId
        }));

        const { error } = await supabase
          .from('product_global_variation_links')
          .insert(links);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Erro ao salvar variações do produto:', error);
    }
  };

  const handleVariationToggle = (variationId: string, checked: boolean) => {
    setSelectedVariations(prev => 
      checked 
        ? [...prev, variationId]
        : prev.filter(id => id !== variationId)
    );
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

          {/* Seção de Variações Globais */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Variações Globais</CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecione as variações globais que se aplicam a este produto
              </p>
            </CardHeader>
            <CardContent>
              {globalVariations.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-3">Nenhuma variação global encontrada</p>
                  <p className="text-sm text-muted-foreground">
                    Para usar variações globais, crie-as primeiro na aba "Variações Globais" da página de Produtos.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {globalVariations.map((variation: any) => (
                    <div key={variation.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`variation-${variation.id}`}
                        checked={selectedVariations.includes(variation.id)}
                        onCheckedChange={(checked) => 
                          handleVariationToggle(variation.id, checked as boolean)
                        }
                      />
                      <div className="flex-1">
                        <Label 
                          htmlFor={`variation-${variation.id}`}
                          className="font-medium cursor-pointer"
                        >
                          {variation.name}
                        </Label>
                        {variation.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {variation.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Máx: {variation.max_selections}
                          </Badge>
                          {variation.required && (
                            <Badge variant="secondary" className="text-xs">
                              Obrigatório
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {variation.options?.length || 0} opções
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
