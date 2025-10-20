
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
<<<<<<< HEAD
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
=======
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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
<<<<<<< HEAD
  onSave: (productId?: string) => void;
=======
  onSave: () => void;
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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
<<<<<<< HEAD
  const [variationSettings, setVariationSettings] = useState<Record<string, { required: boolean; min_selections: number; max_selections: number }>>({});
  const [loading, setLoading] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Função para formatar preço em Real brasileiro
  const formatPrice = (value: string) => {
    // Remove tudo que não é número
    const numericValue = value.replace(/\D/g, '');
    
    if (!numericValue) return '';
    
    // Converte para número e divide por 100 para ter centavos
    const number = parseInt(numericValue) / 100;
    
    // Formata como moeda brasileira
    return number.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Função para converter preço formatado para número
  const parsePrice = (formattedPrice: string): number => {
    if (!formattedPrice) return 0;
    
    // Remove pontos de milhares e substitui vírgula por ponto
    const numericString = formattedPrice
      .replace(/\./g, '')
      .replace(',', '.');
    
    return parseFloat(numericString) || 0;
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatPrice(inputValue);
    const numericValue = parsePrice(formatted);
    
    setFormData(prev => ({ ...prev, price: numericValue }));
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Nome da categoria é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setCreatingCategory(true);
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .insert([{ name: newCategoryName.trim() }])
        .select()
        .single();

      if (error) throw error;

      // Atualiza a lista de categorias
      setCategories(prev => [...prev, data]);
      
      // Seleciona a nova categoria
      setFormData(prev => ({ 
        ...prev, 
        category: data.name,
        category_id: data.id 
      }));

      setNewCategoryName('');
      setShowCreateCategory(false);
      
      toast({
        title: "Categoria criada com sucesso!",
        description: `A categoria "${data.name}" foi adicionada.`
      });
    } catch (error: any) {
      console.error('Erro ao criar categoria:', error);
      toast({
        title: "Erro ao criar categoria",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setCreatingCategory(false);
    }
  };
=======
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44

  useEffect(() => {
    loadCategories();
    loadGlobalVariations();
    if (product?.id) {
      loadProductVariations(product.id);
    }
  }, [product?.id]);

<<<<<<< HEAD


=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
<<<<<<< HEAD
=======
        .eq('user_id', user?.id)
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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
<<<<<<< HEAD
        .order('name');

      if (error) throw error;
      setGlobalVariations((data || []).map((variation: any) => ({
        ...variation,
        options: typeof variation.options === 'string' ? JSON.parse(variation.options) : variation.options
      })));
=======
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setGlobalVariations(data || []);
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    } catch (error) {
      console.error('Erro ao carregar variações globais:', error);
    }
  };

  const loadProductVariations = async (productId: string) => {
<<<<<<< HEAD
    console.log('🔍 Carregando variações do produto:', productId);
    try {
      const { data, error } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id, required, min_selections, max_selections')
        .eq('product_id', productId);

      console.log('📊 Resultado da consulta de variações:', { data, error });

      if (error) throw error;
      
      const variationIds = data?.map(link => link.global_variation_id) || [];
      console.log('🎯 IDs das variações carregadas:', variationIds);
      
      setSelectedVariations(variationIds);
      
      const settings: Record<string, { required: boolean; min_selections: number; max_selections: number }> = {};
      data?.forEach(link => {
        settings[link.global_variation_id] = {
          required: link.required,
          min_selections: link.min_selections,
          max_selections: link.max_selections
        };
      });
      
      console.log('⚙️ Configurações das variações carregadas:', settings);
      setVariationSettings(settings);
      
    } catch (error) {
      console.error('❌ Erro ao carregar variações do produto:', error);
=======
    try {
      const { data, error } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id')
        .eq('product_id', productId);

      if (error) throw error;
      setSelectedVariations(data?.map(link => link.global_variation_id) || []);
    } catch (error) {
      console.error('Erro ao carregar variações do produto:', error);
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
<<<<<<< HEAD
=======
    
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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
<<<<<<< HEAD
      const productData = {
        ...formData,
        updated_at: new Date().toISOString()
      };
      let productId = product?.id;
=======
      
      const productData = {
        ...formData,
        user_id: user?.id,
        updated_at: new Date().toISOString()
      };

      let productId = product?.id;

>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
      if (product?.id) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);
<<<<<<< HEAD
=======

>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select('id')
          .single();
<<<<<<< HEAD
        if (error) throw error;
        if (data && data.id) {
          productId = data.id;
        }
      }
      // Salvar vínculos de variações globais após salvar produto
      if (productId) {
        await saveProductVariations(productId);
      }
=======

        if (error) throw error;
        productId = data.id;
      }

      // Salvar variações globais selecionadas
      await saveProductVariations(productId!);

>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
      toast({
        title: "Sucesso",
        description: `Produto ${product?.id ? 'atualizado' : 'criado'} com sucesso!`,
      });
<<<<<<< HEAD
      onSave(productId);
=======

      onSave(); // Call the simplified callback
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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

<<<<<<< HEAD
  const saveProductVariations = async (productId: string, variations: string[] = selectedVariations, settings: Record<string, { required: boolean; min_selections: number; max_selections: number }> = variationSettings) => {
    console.log('🔄 Iniciando saveProductVariations:', { 
      productId, 
      variations, 
      settings,
      selectedVariations,
      variationSettings 
    });
    
    try {
      // Primeiro, deletar vínculos existentes
      console.log('🗑️ Deletando vínculos existentes para produto:', productId);
      const { error: deleteError } = await supabase
        .from('product_global_variation_links')
        .delete()
        .eq('product_id', productId);
      
      if (deleteError) {
        console.error('❌ Erro ao deletar vínculos existentes:', deleteError);
        throw deleteError;
      }
      
      console.log('✅ Vínculos existentes deletados com sucesso');
      
      if (variations.length > 0) {
        console.log('📝 Criando novos vínculos para', variations.length, 'variações');
        
        const links = variations.map(variationId => {
          const setting = settings[variationId];
          const link = {
            product_id: productId,
            global_variation_id: variationId,
            required: setting?.required || false,
            min_selections: setting?.min_selections || 0,
            max_selections: setting?.max_selections || 1
          };
          console.log('🔗 Criando vínculo:', link);
          return link;
        });
        
        console.log('💾 Inserindo vínculos no banco:', links);
        const { data, error } = await supabase
          .from('product_global_variation_links')
          .insert(links);
          
        console.log('📊 Resultado da inserção:', { data, error });
        
        if (error) {
          console.error('❌ Erro ao inserir vínculos:', error);
          toast({
            title: "Erro ao salvar vínculo de variações globais",
            description: error.message,
            variant: "destructive"
          });
          throw error;
        } else {
          console.log('✅ Vínculos inseridos com sucesso!');
          toast({
            title: "Variações globais vinculadas",
            description: `${variations.length} variações globais salvas com sucesso!`,
            variant: "default"
          });
        }
      } else {
        console.log('ℹ️ Nenhuma variação selecionada para salvar');
      }
    } catch (error) {
      console.error('💥 Erro geral ao salvar variações do produto:', error);
      toast({
        title: "Erro ao salvar variações",
        description: "Ocorreu um erro ao salvar as variações globais",
        variant: "destructive"
      });
=======
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
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    }
  };

  const handleVariationToggle = (variationId: string, checked: boolean) => {
<<<<<<< HEAD
    setSelectedVariations(prev => {
      const updated = checked 
        ? [...prev, variationId]
        : prev.filter(id => id !== variationId);
      console.log('DEBUG handleVariationToggle updated:', updated);
      return updated;
    });
    if (checked) {
      setVariationSettings(prev => ({
        ...prev,
        [variationId]: prev[variationId] || { required: false, min_selections: 0, max_selections: 1 }
      }));
    } else {
      setVariationSettings(prev => {
        const copy = { ...prev };
        delete copy[variationId];
        return copy;
      });
    }
  };

  const handleVariationSettingChange = (variationId: string, field: 'required' | 'min_selections' | 'max_selections', value: boolean | number) => {
    setVariationSettings(prev => ({
      ...prev,
      [variationId]: {
        ...prev[variationId],
        [field]: value
      }
    }));
  };


=======
    setSelectedVariations(prev => 
      checked 
        ? [...prev, variationId]
        : prev.filter(id => id !== variationId)
    );
  };

>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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
<<<<<<< HEAD
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground font-medium">
                  R$
                </span>
                <Input
                  id="price"
                  type="text"
                  value={formatPrice((formData.price * 100).toString())}
                  onChange={handlePriceChange}
                  className="pl-10"
                  placeholder="0,00"
                  required
                />
              </div>
=======
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                required
              />
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
<<<<<<< HEAD
            <div className="flex gap-2">
              <Select 
                value={formData.category} 
                onValueChange={(value) => {
                  const category = categories.find((cat: any) => cat.name === value);
                  setFormData(prev => ({ 
                    ...prev, 
                    category: value,
                    category_id: category?.id || null
                  }));
                }}
              >
                <SelectTrigger className="flex-1">
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
              
              <Dialog open={showCreateCategory} onOpenChange={setShowCreateCategory}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Categoria</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-category">Nome da Categoria</Label>
                      <Input
                        id="new-category"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Digite o nome da categoria"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            createCategory();
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowCreateCategory(false);
                          setNewCategoryName('');
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        type="button" 
                        onClick={createCategory}
                        disabled={creatingCategory || !newCategoryName.trim()}
                      >
                        {creatingCategory ? 'Criando...' : 'Criar'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
=======
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
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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
<<<<<<< HEAD
                        onCheckedChange={(checked) => handleVariationToggle(variation.id, checked as boolean)}
                      />
                      <div className="flex-1">
                        <Label htmlFor={`variation-${variation.id}`} className="font-medium cursor-pointer">
                          {variation.name}
                        </Label>
                        {variation.description && (
                          <p className="text-sm text-muted-foreground mt-1">{variation.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{variation.options?.length || 0} opções</span>
                        </div>
                        {selectedVariations.includes(variation.id) && (
                          <div className="flex gap-4 mt-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`required-${variation.id}`}
                                checked={variationSettings[variation.id]?.required || false}
                                onCheckedChange={(checked) => handleVariationSettingChange(variation.id, 'required', checked as boolean)}
                              />
                              <Label htmlFor={`required-${variation.id}`}>Obrigatório</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`min-selections-${variation.id}`}>Mín.</Label>
                              <Input
                                id={`min-selections-${variation.id}`}
                                type="number"
                                min="0"
                                value={variationSettings[variation.id]?.min_selections ?? 0}
                                onChange={e => handleVariationSettingChange(variation.id, 'min_selections', parseInt(e.target.value) || 0)}
                                className="w-16"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`max-selections-${variation.id}`}>Máx.</Label>
                              <Input
                                id={`max-selections-${variation.id}`}
                                type="number"
                                min="1"
                                value={variationSettings[variation.id]?.max_selections ?? 1}
                                onChange={e => handleVariationSettingChange(variation.id, 'max_selections', parseInt(e.target.value) || 1)}
                                className="w-16"
                              />
                            </div>
                          </div>
                        )}
=======
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
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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
<<<<<<< HEAD

// TODO: Removido temporariamente toda a lógica de variações globais para reimplementação.
// O formulário de produto funcionará apenas com os campos básicos até a nova lógica ser implementada.



// Função para formatar preço em Real brasileiro
const formatPrice = (value: string) => {
// Remove tudo que não é número
const numericValue = value.replace(/\D/g, '');

if (!numericValue) return '';

// Converte para número e divide por 100 para ter centavos
const number = parseInt(numericValue) / 100;

// Formata como moeda brasileira
return number.toLocaleString('pt-BR', {
minimumFractionDigits: 2,
maximumFractionDigits: 2
});
};

// Função para converter preço formatado para número
const parsePrice = (formattedPrice: string): number => {
if (!formattedPrice) return 0;

// Remove pontos de milhares e substitui vírgula por ponto
const numericString = formattedPrice
.replace(/\./g, '')
.replace(',', '.');

return parseFloat(numericString) || 0;
};

const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
const inputValue = e.target.value;
const formatted = formatPrice(inputValue);
const numericValue = parsePrice(formatted);

setFormData(prev => ({ ...prev, price: numericValue }));
};

const createCategory = async () => {
if (!newCategoryName.trim()) {
toast({
title: "Nome da categoria é obrigatório",
variant: "destructive"
});
return;
}

setCreatingCategory(true);
try {
const { data, error } = await supabase
.from('categories')
.insert([{ name: newCategoryName.trim() }])
.select()
.single();

if (error) throw error;

// Atualiza a lista de categorias
setCategories(prev => [...prev, data]);

// Seleciona a nova categoria
setFormData(prev => ({ 
...prev, 
category: data.name,
category_id: data.id 
}));

setNewCategoryName('');
setShowCreateCategory(false);

toast({
title: "Categoria criada com sucesso!",
description: `A categoria "${data.name}" foi adicionada.`
});
} catch (error: any) {
console.error('Erro ao criar categoria:', error);
toast({
title: "Erro ao criar categoria",
description: error.message,
variant: "destructive"
});
} finally {
setCreatingCategory(false);
}
};
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
