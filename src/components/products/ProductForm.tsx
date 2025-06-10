
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ProductVariation {
  id: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: Array<{ name: string; price: number }>;
}

interface Product {
  id?: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image_url?: string;
  available?: boolean;
  show_in_pdv?: boolean;
  show_in_delivery?: boolean;
  send_to_kds?: boolean;
  weight_based?: boolean;
}

interface ProductFormProps {
  product?: Product;
  onSave: (product: Product) => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Product>({
    name: '',
    price: 0,
    category: '',
    description: '',
    image_url: '',
    available: true,
    show_in_pdv: true,
    show_in_delivery: true,
    send_to_kds: true,
    weight_based: false,
    ...product
  });
  
  const [categories, setCategories] = useState<string[]>([]);
  const [availableVariations, setAvailableVariations] = useState<ProductVariation[]>([]);
  const [selectedVariations, setSelectedVariations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchCategories();
    fetchAvailableVariations();
    if (product?.id) {
      fetchProductVariations();
    }
  }, [product]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('name')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      
      const categoryNames = data?.map(cat => cat.name) || [];
      setCategories(categoryNames);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const fetchAvailableVariations = async () => {
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      
      const transformedData = (data || []).map(item => {
        let parsedOptions = [];
        try {
          if (typeof item.options === 'string') {
            parsedOptions = JSON.parse(item.options);
          } else if (Array.isArray(item.options)) {
            parsedOptions = item.options;
          }
        } catch (e) {
          console.error('Error parsing options:', e);
          parsedOptions = [];
        }

        return {
          id: item.id,
          name: item.name,
          required: item.required,
          max_selections: item.max_selections,
          options: Array.isArray(parsedOptions) ? parsedOptions : []
        };
      });
      
      setAvailableVariations(transformedData);
    } catch (error) {
      console.error('Erro ao carregar variações:', error);
    }
  };

  const fetchProductVariations = async () => {
    if (!product?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('product_variation_links')
        .select('variation_id')
        .eq('product_id', product.id);

      if (error) throw error;
      
      const variationIds = data?.map(link => link.variation_id) || [];
      setSelectedVariations(variationIds);
    } catch (error) {
      console.error('Erro ao carregar variações do produto:', error);
    }
  };

  const handleVariationToggle = (variationId: string, checked: boolean) => {
    if (checked) {
      setSelectedVariations(prev => [...prev, variationId]);
    } else {
      setSelectedVariations(prev => prev.filter(id => id !== variationId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productData = {
        ...formData,
        user_id: user?.id,
        price: Number(formData.price)
      };

      let productId = product?.id;

      if (product?.id) {
        // Atualizar produto existente
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);

        if (error) throw error;
      } else {
        // Criar novo produto
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();

        if (error) throw error;
        productId = data.id;
      }

      // Atualizar variações do produto
      if (productId) {
        // Remover links existentes
        await supabase
          .from('product_variation_links')
          .delete()
          .eq('product_id', productId);

        // Adicionar novos links
        if (selectedVariations.length > 0) {
          const links = selectedVariations.map(variationId => ({
            product_id: productId,
            variation_id: variationId
          }));

          const { error: linkError } = await supabase
            .from('product_variation_links')
            .insert(links);

          if (linkError) throw linkError;
        }
      }

      toast({
        title: "Sucesso",
        description: `Produto ${product ? 'atualizado' : 'criado'} com sucesso.`,
      });

      onSave({ ...formData, id: productId });
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
        <CardTitle>{product ? 'Editar Produto' : 'Novo Produto'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="price">Preço</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) || 0 }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Categoria</Label>
            <Select onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma categoria" defaultValue={formData.category} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="image_url">URL da Imagem</Label>
            <Input
              id="image_url"
              type="text"
              value={formData.image_url}
              onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="available"
              checked={formData.available}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, available: checked }))}
            />
            <Label htmlFor="available">Disponível</Label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label htmlFor="show_in_delivery">Mostrar no Delivery</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="send_to_kds"
                checked={formData.send_to_kds}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, send_to_kds: checked }))}
              />
              <Label htmlFor="send_to_kds">Enviar para KDS</Label>
            </div>
          </div>

          {availableVariations.length > 0 && (
            <div>
              <Label>Variações disponíveis</Label>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                {availableVariations.map(variation => (
                  <div key={variation.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`variation-${variation.id}`}
                      checked={selectedVariations.includes(variation.id)}
                      onCheckedChange={(checked) => handleVariationToggle(variation.id, checked as boolean)}
                    />
                    <Label htmlFor={`variation-${variation.id}`} className="text-sm">
                      {variation.name} ({variation.options.length} opções)
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : (product ? 'Atualizar' : 'Criar')}
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
