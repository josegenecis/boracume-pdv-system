
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
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
  track_stock: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  is_highlight?: boolean;
  original_price?: number;
  discount_percentage?: number;
}

interface ProductFormProps {
  product?: ProductItem;

  onSave: (productId?: string) => void;

  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSave, onCancel }) => {
  const { user } = useAuth();
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
    track_stock: false,
    stock_quantity: 0,
    low_stock_threshold: 5,
    is_highlight: false,
    original_price: 0,
    discount_percentage: 0,
    ...product
  });
  const [categories, setCategories] = useState([]);
  const [globalVariations, setGlobalVariations] = useState([]);
  const [selectedVariations, setSelectedVariations] = useState<string[]>([]);

  const [variationSettings, setVariationSettings] = useState<Record<string, { required: boolean; min_selections: number; max_selections: number }>>({});
  const [loading, setLoading] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [priceRaw, setPriceRaw] = useState<string>(String(Math.round(((product?.price ?? 0) * 100))));
  const [originalPriceRaw, setOriginalPriceRaw] = useState<string>(String(Math.round(((product?.original_price ?? 0) * 100))));
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(product?.id || null);

  // Formata a string de centavos (somente dígitos) para BRL
  const formatFromRaw = (raw: string) => {
    const cents = parseInt(raw || '0', 10) || 0;
    const value = cents / 100;
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    const raw = digitsOnly === '' ? '0' : digitsOnly;
    setPriceRaw(raw);
    setFormData(prev => ({ ...prev, price: (parseInt(raw, 10) || 0) / 100 }));
  };

  const handleOriginalPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    const raw = digitsOnly === '' ? '0' : digitsOnly;
    setOriginalPriceRaw(raw);
    const originalPrice = (parseInt(raw, 10) || 0) / 100;
    
    // Auto calculate discount percentage if price is set
    let discount = 0;
    if (originalPrice > 0 && formData.price > 0 && originalPrice > formData.price) {
      discount = Math.round(((originalPrice - formData.price) / originalPrice) * 100);
    }
    
    setFormData(prev => ({ 
      ...prev, 
      original_price: originalPrice,
      discount_percentage: discount
    }));
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Nome da categoria é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Erro de autenticação",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    setCreatingCategory(true);
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .insert([{ 
          name: newCategoryName.trim(),
          user_id: user.id
        }])
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


  useEffect(() => {
    if (user?.id) {
      loadCategories();
      loadGlobalVariations();
      if (product?.id) {
        loadProductVariations(product.id);
      }
    }
  }, [product?.id, user?.id]);





  const loadCategories = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const loadGlobalVariations = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('global_variations')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setGlobalVariations((data || []).map((variation: any) => ({
        ...variation,
        options: typeof variation.options === 'string' ? JSON.parse(variation.options) : variation.options
      })));

    } catch (error) {
      console.error('Erro ao carregar variações globais:', error);
    }
  };

  const loadProductVariations = async (productId: string) => {

    console.log('🔍 Carregando variações do produto:', productId);
    try {
      const { data, error } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id')
        .eq('product_id', productId);

      console.log('📊 Resultado da consulta de variações:', { data, error });

      if (error) throw error;
      
      const variationIds = data?.map((link: any) => link.global_variation_id) || [];
      console.log('🎯 IDs das variações carregadas:', variationIds);
      
      setSelectedVariations(variationIds);
      
      // Carregar configurações padrão das variações globais
      const gvIds = variationIds.length ? variationIds : [];
      const { data: gvData } = await supabase
        .from('global_variations')
        .select('id, required, max_selections')
        .in('id', gvIds);
      const settings: Record<string, { required: boolean; min_selections: number; max_selections: number }> = {};
      (gvData || []).forEach((gv: any) => {
        settings[gv.id] = {
          required: !!gv.required,
          min_selections: 0,
          max_selections: gv.max_selections ?? 1
        };
      });
      
      console.log('⚙️ Configurações das variações carregadas:', settings);
      setVariationSettings(settings);
      
    } catch (error) {
      console.error('❌ Erro ao carregar variações do produto:', error);

    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();


    if (!user?.id || !formData.name || !formData.category_id || formData.price <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios (nome, categoria e preço).",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const baseData = {
        user_id: user.id,
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        price: formData.price,
        category_id: formData.category_id,
        category: formData.category,
        is_available: formData.available,
        show_in_delivery: formData.show_in_delivery,
        image_url: formData.image_url || null,
        track_stock: formData.track_stock,
        stock_quantity: Math.max(0, Math.floor(Number(formData.stock_quantity) || 0)),
        low_stock_threshold: Math.max(0, Math.floor(Number(formData.low_stock_threshold) || 0)),
        is_highlight: formData.is_highlight,
        original_price: formData.original_price,
        discount_percentage: formData.discount_percentage,
      } as const;
      let productId = product?.id;

      if (product?.id) {
        const productData = {
          ...baseData,
          updated_at: new Date().toISOString()
        } as const;
        console.log('Atualizando produto:', product.id, productData);
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);


        if (error) {
          console.error('Erro ao atualizar produto:', error);
          throw error;
        }
      } else {
        // Tentativa mínima: apenas campos essenciais
        const minimalData = {
          user_id: user.id,
          name: formData.name.trim(),
          price: formData.price,
          category_id: formData.category_id,
          category: formData.category,
          is_available: formData.available,
          show_in_delivery: formData.show_in_delivery,
        } as const;

        let insertResultId: string | null = null;
        console.log('Inserindo produto (mínimo):', minimalData);
        const { data: minimalInsert, error: minimalError } = await supabase
          .from('products')
          .insert([minimalData])
          .select('id')
          .single();

        if (minimalError) {
          console.error('Erro na inserção mínima:', minimalError);
          throw minimalError;
        }
        insertResultId = minimalInsert?.id || null;

        // Atualizar campos adicionais se inserção mínima funcionou
        if (insertResultId) {
          const productData = {
            ...baseData,
            updated_at: new Date().toISOString()
          } as const;
          console.log('Atualizando campos adicionais do produto:', insertResultId, productData);
          const { error: updateError } = await supabase
            .from('products')
            .update(productData)
            .eq('id', insertResultId);
          if (updateError) {
            console.error('Erro ao atualizar campos adicionais:', updateError);
            throw updateError;
          }
        }

        if (insertResultId) {
          productId = insertResultId;
        }
      }
      // Salvar vínculos de variações globais após salvar produto
      if (productId) {
        await saveProductVariations(productId);
      }

      toast({
        title: "Sucesso",
        description: `Produto ${product?.id ? 'atualizado' : 'criado'} com sucesso!`,
      });

      onSave(productId);

    } catch (error: any) {
      console.error('Erro ao salvar produto:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      });
      toast({
        title: "Erro",
        description: error?.message || error?.details || error?.hint || "Erro ao salvar produto.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Autosave: salva automaticamente ao alterar campos essenciais
  useEffect(() => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const timer = setTimeout(async () => {
      // requisitos mínimos
      const canCreate = !!user?.id && !!formData.name.trim() && !!formData.category_id && formData.price > 0;
      if (canCreate) {
        try {
          // se não há product.id, cria mín e atualiza
      if (!createdProductId) {
        const minimalData = {
          user_id: user!.id,
          name: formData.name.trim(),
          price: formData.price,
          category_id: formData.category_id,
          category: formData.category,
          is_available: formData.available,
          show_in_delivery: formData.show_in_delivery,
        } as const;
        const { data: insertData, error: insertErr } = await supabase
          .from('products')
          .insert([minimalData])
          .select('id')
          .single();
        if (!insertErr && insertData?.id) {
            setCreatedProductId(insertData.id);
            // atualiza com campos adicionais
            await supabase
              .from('products')
              .update({
                description: formData.description?.trim() || null,
                image_url: formData.image_url || null,
                track_stock: formData.track_stock,
                stock_quantity: Math.max(0, Math.floor(Number(formData.stock_quantity) || 0)),
                low_stock_threshold: Math.max(0, Math.floor(Number(formData.low_stock_threshold) || 0)),
                is_highlight: formData.is_highlight,
                original_price: formData.original_price,
                discount_percentage: formData.discount_percentage,
                updated_at: new Date().toISOString()
              })
              .eq('id', insertData.id);
        }
      } else {
        await supabase
          .from('products')
          .update({
            name: formData.name.trim(),
            price: formData.price,
            category_id: formData.category_id,
            category: formData.category,
            description: formData.description?.trim() || null,
            image_url: formData.image_url || null,
            is_available: formData.available,
            show_in_delivery: formData.show_in_delivery,
            track_stock: formData.track_stock,
            stock_quantity: Math.max(0, Math.floor(Number(formData.stock_quantity) || 0)),
            low_stock_threshold: Math.max(0, Math.floor(Number(formData.low_stock_threshold) || 0)),
            is_highlight: formData.is_highlight,
            original_price: formData.original_price,
            discount_percentage: formData.discount_percentage,
            updated_at: new Date().toISOString()
          })
          .eq('id', createdProductId);
      }
        } catch (err) {
          console.warn('Autosave produto falhou', err);
        }
      }
    }, 800);
    setAutoSaveTimer(timer);
    return () => clearTimeout(timer);
  }, [formData.name, formData.price, formData.category_id, formData.category, formData.description, formData.image_url, formData.available, formData.show_in_delivery, formData.is_highlight, formData.original_price]);


  const saveProductVariations = async (productId: string, variations: string[] = selectedVariations) => {
    console.log('🔄 Iniciando saveProductVariations:', { 
      productId, 
      variations, 
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
        
        const links = variations.map(variationId => ({
          product_id: productId,
          global_variation_id: variationId
        }));
        
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

    }
  };

  const handleVariationToggle = (variationId: string, checked: boolean) => {

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

              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground font-medium">
                  R$
                </span>
                <Input
                  id="price"
                  type="text"
                  value={formatFromRaw(priceRaw)}
                  onChange={handlePriceChange}
                  className="pl-10"
                  placeholder="0,00"
                  required
                />
              </div>

            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="original_price">Preço Original (opcional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground font-medium">
                  R$
                </span>
                <Input
                  id="original_price"
                  type="text"
                  value={formatFromRaw(originalPriceRaw)}
                  onChange={handleOriginalPriceChange}
                  className="pl-10"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_percentage">Desconto Calculado (%)</Label>
              <Input
                id="discount_percentage"
                type="number"
                value={formData.discount_percentage}
                readOnly
                className="bg-gray-50"
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>

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

            <div className="flex items-center space-x-2">
              <Switch
                id="is_highlight"
                checked={formData.is_highlight}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_highlight: checked }))}
              />
              <Label htmlFor="is_highlight">Destaque</Label>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estoque</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="track_stock"
                    checked={formData.track_stock}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, track_stock: checked }))}
                  />
                  <Label htmlFor="track_stock">Controlar estoque</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="low_stock_threshold">Estoque mínimo</Label>
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    value={String(formData.low_stock_threshold ?? 0)}
                    onChange={(e) => setFormData(prev => ({ ...prev, low_stock_threshold: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))}
                    disabled={!formData.track_stock}
                    min={0}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock_quantity">Estoque atual</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  value={String(formData.stock_quantity ?? 0)}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))}
                  disabled={!formData.track_stock}
                  min={0}
                />
              </div>
            </CardContent>
          </Card>

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
                          <div className="flex gap-4 mt-2 flex-wrap sm:flex-nowrap">
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
                                className="w-14 min-w-[56px] text-center appearance-none"
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
                                className="w-14 min-w-[56px] text-center appearance-none"
                              />
                            </div>
                          </div>
                        )}

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
