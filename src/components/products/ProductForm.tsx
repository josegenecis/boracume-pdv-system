import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { GripVertical, MoreVertical, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';

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

interface ProductVariant {
  id?: string;
  name: string;
  price: number;
  promotional_price?: number;
  display_order: number;
  _deleted?: boolean; // internal flag
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
  
  // Price Variants State
  const [priceVariants, setPriceVariants] = useState<ProductVariant[]>([]);

  const [variationSettings, setVariationSettings] = useState<Record<string, { required: boolean; min_selections: number; max_selections: number }>>({});
  const [loading, setLoading] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [priceRaw, setPriceRaw] = useState<string>(String(Math.round(((product?.price ?? 0) * 100))));
  const [originalPriceRaw, setOriginalPriceRaw] = useState<string>(String(Math.round(((product?.original_price ?? 0) * 100))));
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(product?.id || null);
  const [stockSchemaSupported, setStockSchemaSupported] = useState(true);
  const [stockSchemaError, setStockSchemaError] = useState<string | null>(null);
  const [unsupportedColumns, setUnsupportedColumns] = useState<string[]>([]);
  const [isEnhanceOpen, setIsEnhanceOpen] = useState(false);
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [enhancedPreview, setEnhancedPreview] = useState<string>('');
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [priceMode, setPriceMode] = useState<'simple' | 'variants'>('simple');
  const [variationsDialogOpen, setVariationsDialogOpen] = useState(false);
  const [expandedVariationId, setExpandedVariationId] = useState<string | null>(null);
  const variationSaveTimerRef = useRef<number | null>(null);

  const isUnsupported = (column: string) => unsupportedColumns.includes(column);
  const markUnsupported = (column: string) => {
    setUnsupportedColumns(prev => (prev.includes(column) ? prev : [...prev, column]));
  };

  const getMissingColumnFromError = (err: any) => {
    const msg = String(err?.message || err?.details || err?.hint || '');
    const m = msg.match(/Could not find the '([^']+)' column/);
    return m?.[1] || null;
  };

  const stockColumns = new Set(['track_stock', 'stock_quantity', 'low_stock_threshold']);

  const getImageAsDataUrl = async (url: string): Promise<string> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Não foi possível baixar a imagem');
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao ler imagem'));
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  };

  const enhanceImageLocal = async (sourceUrl: string): Promise<string> => {
    const dataUrl = sourceUrl.startsWith('data:') ? sourceUrl : await getImageAsDataUrl(sourceUrl);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Falha ao carregar imagem'));
      i.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível');

    ctx.filter = 'contrast(1.12) saturate(1.18) brightness(1.03)';
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png', 0.92);
  };

  const uploadEnhancedToStorage = async (dataUrl: string): Promise<string> => {
    const blob = await (await fetch(dataUrl)).blob();
    const fileName = `ai-enhanced-${Date.now()}.png`;
    const filePath = `products/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, blob, { contentType: 'image/png', upsert: true } as any);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleOpenEnhance = async () => {
    if (!formData.image_url) {
      toast({ title: 'Sem imagem', description: 'Adicione uma imagem antes de melhorar.', variant: 'destructive' });
      return;
    }
    setIsEnhanceOpen(true);
    setEnhanceLoading(true);
    setEnhancedPreview('');
    try {
      const { data } = await invokeEdgeFunction<any>('enhance-product-image', { 
        imageUrl: formData.image_url,
        productName: formData.name // Envia o nome também
      });
      if (data?.ok && data?.imageBase64) {
        setEnhancedPreview(String(data.imageBase64));
        return;
      }
      const localEnhanced = await enhanceImageLocal(formData.image_url);
      setEnhancedPreview(localEnhanced);
    } catch {
      const localEnhanced = await enhanceImageLocal(formData.image_url);
      setEnhancedPreview(localEnhanced);
    } finally {
      setEnhanceLoading(false);
    }
  };

  const handleUseEnhanced = async () => {
    if (!enhancedPreview) return;
    try {
      setLoading(true);
      const url = enhancedPreview.startsWith('http') ? enhancedPreview : await uploadEnhancedToStorage(enhancedPreview);
      setFormData(prev => ({ ...prev, image_url: url }));
      toast({ title: 'Imagem atualizada', description: 'A imagem aprimorada foi aplicada ao produto.' });
      setIsEnhanceOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Não foi possível aplicar a imagem.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDescription = async () => {
    try {
      if (!formData.name.trim()) {
        toast({ title: 'Informe o nome', description: 'Preencha o nome do produto para gerar a descrição.', variant: 'destructive' });
        return;
      }
      setGeneratingDescription(true);
      const payload = {
        name: formData.name,
        category: formData.category,
        price: formData.price,
        currentDescription: formData.description || ''
      };
      const { data } = await invokeEdgeFunction<any>('generate-product-description', payload);
      if (data?.ok && data?.description) {
        setFormData(prev => ({ ...prev, description: String(data.description) }));
        toast({ title: 'Descrição gerada', description: 'Revise o texto antes de salvar.' });
        return;
      }
      const fallback = formData.description?.trim()
        ? formData.description
        : `${formData.name}${formData.category ? ` (${formData.category})` : ''}.`;
      setFormData(prev => ({ ...prev, description: fallback }));
      toast({ title: 'Descrição sugerida', description: 'Revise o texto antes de salvar.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao gerar descrição.', variant: 'destructive' });
    } finally {
      setGeneratingDescription(false);
    }
  };

  const buildBaseData = () => {
    const baseData: any = {
      user_id: user?.id,
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      price: formData.price,
      category_id: formData.category_id,
      category: formData.category,
      available: formData.available,
      weight_based: formData.weight_based,
      send_to_kds: formData.send_to_kds,
      show_in_pdv: formData.show_in_pdv,
      show_in_delivery: formData.show_in_delivery,
      image_url: formData.image_url || null,
    };

    if (!isUnsupported('is_highlight')) baseData.is_highlight = formData.is_highlight;
    if (!isUnsupported('original_price')) baseData.original_price = formData.original_price;
    if (!isUnsupported('discount_percentage')) baseData.discount_percentage = formData.discount_percentage;

    if (stockSchemaSupported && !isUnsupported('track_stock') && !isUnsupported('stock_quantity') && !isUnsupported('low_stock_threshold')) {
      baseData.track_stock = formData.track_stock;
      baseData.stock_quantity = Math.max(0, Math.floor(Number(formData.stock_quantity) || 0));
      baseData.low_stock_threshold = Math.max(0, Math.floor(Number(formData.low_stock_threshold) || 0));
    }

    return baseData;
  };

  const updateProductWithFallback = async (productId: string, data: any) => {
    let payload: any = { ...data };
    const removed = new Set<string>();
    while (true) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', productId);
      if (!error) return;

      const missing = getMissingColumnFromError(error);
      if (String((error as any)?.code || '') === 'PGRST204' && missing && !removed.has(missing)) {
        removed.add(missing);
        markUnsupported(missing);
        if (stockColumns.has(missing)) {
          setStockSchemaSupported(false);
          setStockSchemaError(`${(error as any)?.code ? `${(error as any).code}: ` : ''}${String((error as any)?.message || '')}`);
        }
        delete payload[missing];
        continue;
      }
      throw error;
    }
  };

  const checkStockSchema = async () => {
    try {
      setStockSchemaError(null);
      const { error } = await (supabase as any)
        .from('products')
        .select('id, track_stock')
        .eq('user_id', user?.id)
        .limit(1);

      if (error) {
        const msg = String((error as any)?.message || (error as any)?.details || '');
        const code = String((error as any)?.code || '');
        const missing = getMissingColumnFromError(error);
        if (
          (code === 'PGRST204' && missing && stockColumns.has(missing)) ||
          (msg.includes('track_stock') && msg.toLowerCase().includes('schema cache'))
        ) {
          setStockSchemaSupported(false);
          setStockSchemaError(`${code ? `${code}: ` : ''}${msg}`);
          return false;
        }
      }

      setStockSchemaSupported(true);
      return true;
    } catch (e: any) {
      setStockSchemaSupported(true);
      return true;
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    checkStockSchema().catch(() => {});
  }, [user?.id]);

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
        loadPriceVariants(product.id);
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
      let data: any[] | null = null;
      let error: any = null;
      try {
        const res = await supabase
          .from('product_global_variation_links')
          .select('global_variation_id, required, min_selections, max_selections, display_order')
          .eq('product_id', productId)
          .order('display_order', { ascending: true });
        data = (res as any).data;
        error = (res as any).error;
      } catch (e: any) {
        error = e;
      }

      const errMsg = String((error as any)?.message || '');
      if (error && (errMsg.includes('min_selections') || errMsg.includes('max_selections') || errMsg.includes('display_order') || errMsg.includes('required'))) {
        const res = await supabase
          .from('product_global_variation_links')
          .select('global_variation_id')
          .eq('product_id', productId);
        data = (res as any).data;
        error = (res as any).error;
      }

      console.log('📊 Resultado da consulta de variações:', { data, error });

      if (error) throw error;
      
      const links = (data || []) as any[];
      const variationIds = links?.map((link: any) => link.global_variation_id).filter(Boolean) || [];
      console.log('🎯 IDs das variações carregadas:', variationIds);
      
      setSelectedVariations(variationIds);
      
      const gvIds = variationIds.length ? variationIds : [];
      const { data: gvData } = await supabase
        .from('global_variations')
        .select('id, required, max_selections')
        .in('id', gvIds);

      const byId = new Map((gvData || []).map((gv: any) => [String(gv.id), gv]));
      const settings: Record<string, { required: boolean; min_selections: number; max_selections: number }> = {};
      for (const link of links) {
        const id = String(link.global_variation_id || '');
        if (!id) continue;
        const gv = byId.get(id);
        const required = link.required !== undefined && link.required !== null ? Boolean(link.required) : Boolean(gv?.required);
        const minSel = link.min_selections !== undefined && link.min_selections !== null ? Math.max(0, Number(link.min_selections) || 0) : 0;
        const maxSel = link.max_selections !== undefined && link.max_selections !== null ? Math.max(1, Number(link.max_selections) || 1) : Math.max(1, Number(gv?.max_selections) || 1);
        settings[id] = { required, min_selections: minSel, max_selections: Math.max(maxSel, minSel) };
      }
      
      console.log('⚙️ Configurações das variações carregadas:', settings);
      setVariationSettings(settings);
      return;
    } catch (error) {
      console.error('❌ Erro ao carregar variações do produto:', error);
      await loadProductVariationsLegacy(productId);
    }
  };

  const loadProductVariationsLegacy = async (productId: string) => {
    console.log('🔍 Carregando variações do produto (legacy):', productId);
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

  const loadPriceVariants = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('display_order');
      
      if (error) {
        // If table doesn't exist yet, just ignore (might happen during dev)
        if (error.code === '42P01') return;
        throw error;
      }

      if (data && data.length > 0) {
        setPriceVariants(data);
        setPriceMode('variants');
      }
    } catch (error) {
      console.error('Erro ao carregar variantes de preço:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();


    if (!user?.id || !formData.name || !formData.category_id || (priceMode === 'simple' && formData.price <= 0)) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios (nome, categoria e preço).",
        variant: "destructive"
      });
      return;
    }
    
    if (priceMode === 'variants' && priceVariants.filter(v => !v._deleted).length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma variante de preço ou mude para preço simples.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const baseData = buildBaseData();
      // If using variants, maybe set base price to 0 or min variant price
      if (priceMode === 'variants') {
        const minPrice = Math.min(...priceVariants.filter(v => !v._deleted).map(v => v.price));
        baseData.price = minPrice > 0 ? minPrice : 0;
      }

      let productId = product?.id;

      if (product?.id) {
        const productData = {
          ...baseData,
          updated_at: new Date().toISOString()
        } as const;
        console.log('Atualizando produto:', product.id, productData);
        await updateProductWithFallback(product.id, productData);
      } else {
        // Tentativa mínima: apenas campos essenciais
        const minimalData = {
          user_id: user.id,
          name: formData.name.trim(),
          price: formData.price,
          category_id: formData.category_id,
          category: formData.category,
          available: formData.available,
          weight_based: formData.weight_based,
          send_to_kds: formData.send_to_kds,
          show_in_pdv: formData.show_in_pdv,
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
          await updateProductWithFallback(insertResultId, productData);
        }

        if (insertResultId) {
          productId = insertResultId;
        }
      }
      
      // Salvar vínculos de variações globais
      if (productId) {
        await saveProductVariations(productId);
        
        // Salvar variantes de preço
        if (priceMode === 'variants') {
          await savePriceVariants(productId);
        } else {
            // Check if we need to clear existing variants if switching back to simple?
            // Maybe optional, but cleaner.
        }
      }

      toast({
        title: "Sucesso",
        description: `Produto ${product?.id ? 'atualizado' : 'criado'} com sucesso!`,
      });

      onSave(productId);

    } catch (error: any) {
      const rawMsg = String(error?.message || error?.details || error?.hint || '');
      const missing = getMissingColumnFromError(error);
      if (String(error?.code || '') === 'PGRST204' && missing) {
        markUnsupported(missing);
        if (stockColumns.has(missing)) {
          setStockSchemaSupported(false);
          setStockSchemaError(`${error?.code ? `${error.code}: ` : ''}${rawMsg}`);
        }
      }
      console.error('Erro ao salvar produto:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      });
      toast({
        title: "Erro",
        description: rawMsg.includes('track_stock') || rawMsg.includes('stock_quantity') || rawMsg.includes('low_stock_threshold')
          ? `Seu banco conectado ao app ainda não tem o controle de estoque. Rode o SQL de estoque no Supabase do projeto ${(supabase as any)?.supabaseUrl || ''} e tente novamente.`
          : (String(error?.code || '') === 'PGRST204' && missing)
            ? `O banco conectado ao app não tem a coluna "${missing}". Ajuste o banco (ou rode reload schema) e tente novamente.`
          : (error?.message || error?.details || error?.hint || "Erro ao salvar produto."),
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
          available: formData.available,
          weight_based: formData.weight_based,
          send_to_kds: formData.send_to_kds,
          show_in_pdv: formData.show_in_pdv,
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
            const additional: any = {
              ...buildBaseData(),
              updated_at: new Date().toISOString()
            };
            await updateProductWithFallback(insertData.id, additional);
        }
      } else {
        const updateData: any = {
          ...buildBaseData(),
          updated_at: new Date().toISOString()
        };
        await updateProductWithFallback(createdProductId, updateData);
      }
        } catch (err) {
          const rawMsg = String((err as any)?.message || (err as any)?.details || '');
          const missing = getMissingColumnFromError(err);
          if (String((err as any)?.code || '') === 'PGRST204' && missing) {
            markUnsupported(missing);
            if (stockColumns.has(missing)) {
              setStockSchemaSupported(false);
              setStockSchemaError(`${(err as any)?.code ? `${(err as any).code}: ` : ''}${rawMsg}`);
            }
          }
          console.warn('Autosave produto falhou', err);
        }
      }
    }, 800);
    setAutoSaveTimer(timer);
    return () => clearTimeout(timer);
  }, [formData.name, formData.price, formData.category_id, formData.category, formData.description, formData.image_url, formData.available, formData.show_in_delivery, formData.is_highlight, formData.original_price, formData.track_stock, formData.stock_quantity, formData.low_stock_threshold, stockSchemaSupported]);


  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(selectedVariations);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setSelectedVariations(items);
  };

  const saveProductVariations = async (
    productId: string,
    variations: string[] = selectedVariations,
    options?: { silent?: boolean }
  ) => {
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
        
        const links = variations.map((variationId, idx) => {
          const s = variationSettings?.[variationId] || { required: false, min_selections: 0, max_selections: 1 };
          const minSel = Math.max(0, Math.floor(Number(s.min_selections) || 0));
          const maxSel = Math.max(1, Math.floor(Number(s.max_selections) || 1));
          return {
            product_id: productId,
            global_variation_id: variationId,
            required: Boolean(s.required),
            min_selections: minSel,
            max_selections: Math.max(maxSel, minSel),
            display_order: idx
          };
        });
        
        console.log('💾 Inserindo vínculos no banco:', links);
        let data: any = null;
        let error: any = null;
        const first = await supabase.from('product_global_variation_links').insert(links);
        data = (first as any).data;
        error = (first as any).error;

        const errMsg = String(error?.message || '');
        if (error && (errMsg.includes('required') || errMsg.includes('min_selections') || errMsg.includes('max_selections') || errMsg.includes('display_order'))) {
          const minimalLinks = variations.map((variationId) => ({
            product_id: productId,
            global_variation_id: variationId
          }));
          const second = await supabase.from('product_global_variation_links').insert(minimalLinks);
          data = (second as any).data;
          error = (second as any).error;
        }
          
        console.log('📊 Resultado da inserção:', { data, error });
        
        if (error) {
          console.error('❌ Erro ao inserir vínculos:', error);
          if (!options?.silent) {
            toast({
              title: "Erro ao salvar vínculo de variações globais",
              description: error.message,
              variant: "destructive"
            });
          }
          throw error;
        } else {
          console.log('✅ Vínculos inseridos com sucesso!');
          if (!options?.silent) {
            toast({
              title: "Variações globais vinculadas",
              description: `${variations.length} variações globais salvas com sucesso!`,
              variant: "default"
            });
          }
        }
      } else {
        console.log('ℹ️ Nenhuma variação selecionada para salvar');
      }
    } catch (error) {
      console.error('💥 Erro geral ao salvar variações do produto:', error);
      if (!options?.silent) {
        toast({
          title: "Erro ao salvar variações",
          description: "Ocorreu um erro ao salvar as variações globais",
          variant: "destructive"
        });
      }

    }
  };

  useEffect(() => {
    const pid = product?.id || createdProductId;
    if (!pid) return;
    if (variationSaveTimerRef.current) window.clearTimeout(variationSaveTimerRef.current);
    variationSaveTimerRef.current = window.setTimeout(() => {
      void saveProductVariations(pid, selectedVariations, { silent: true });
    }, 900);
    return () => {
      if (variationSaveTimerRef.current) window.clearTimeout(variationSaveTimerRef.current);
      variationSaveTimerRef.current = null;
    };
  }, [product?.id, createdProductId, selectedVariations, variationSettings]);

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

  // Price Variants Functions
  const handleAddPriceVariant = () => {
    const newVariant: ProductVariant = {
      name: 'Novo Tamanho',
      price: 0,
      display_order: priceVariants.length
    };
    setPriceVariants([...priceVariants, newVariant]);
  };

  const handleRemovePriceVariant = (index: number) => {
    setPriceVariants(prev => {
      const next = [...prev];
      if (next[index].id) {
        next[index]._deleted = true;
      } else {
        next.splice(index, 1);
      }
      return next;
    });
  };

  const handlePriceVariantChange = (index: number, field: keyof ProductVariant, value: any) => {
    setPriceVariants(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const onPriceVariantsDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(priceVariants);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update display_order based on new index
    const updated = items.map((item, idx) => ({ ...item, display_order: idx }));
    setPriceVariants(updated);
  };

  const savePriceVariants = async (productId: string) => {
    try {
      const toDelete = priceVariants.filter(v => v._deleted && v.id).map(v => v.id);
      const toUpsert = priceVariants.filter(v => !v._deleted).map((v, idx) => ({
        id: v.id,
        product_id: productId,
        name: v.name,
        price: v.price,
        display_order: idx
      }));

      if (toDelete.length > 0) {
        await supabase.from('product_variants').delete().in('id', toDelete);
      }

      if (toUpsert.length > 0) {
        // Remove IDs from new items to let DB generate them
        const { error } = await supabase.from('product_variants').upsert(toUpsert.map(v => {
            if (!v.id) {
                const { id, ...rest } = v;
                return rest;
            }
            return v;
        }));
        if (error) throw error;
      }
    } catch (error) {
      console.error('Erro ao salvar variantes de preço:', error);
      toast({
        title: "Erro ao salvar variantes de preço",
        variant: "destructive"
      });
    }
  };


  return (
    <div>
      <div className="flex items-center gap-2 justify-between px-4 py-3 border-b bg-white">
        <div className="text-sm font-semibold">{product?.id ? 'Editar produto' : 'Novo produto'}</div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
            <Star className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
        <div className="pt-3 grid grid-cols-[auto,1fr] gap-3 items-start">
          <ProductImageUpload
            compact
            onImageUploaded={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
            currentImageUrl={formData.image_url}
          />

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="relative" onClick={handleOpenEnhance} disabled={loading}>
            <Sparkles className="h-4 w-4 mr-2" />
            Melhorar imagem
            <Badge className="absolute -top-2 right-2 bg-boracume-orange">IA</Badge>
          </Button>
          <Button type="button" variant="outline" className="relative" onClick={handleGenerateDescription} disabled={generatingDescription}>
            <Sparkles className="h-4 w-4 mr-2" />
            {generatingDescription ? 'Gerando...' : 'Gerar descrição'}
            <Badge className="absolute -top-2 right-2 bg-boracume-orange">IA</Badge>
          </Button>
        </div>

        <Dialog open={isEnhanceOpen} onOpenChange={setIsEnhanceOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Melhorar imagem com IA</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Imagem atual</div>
                <div className="border rounded-lg p-2 bg-white">
                  {formData.image_url ? (
                    <img src={formData.image_url} alt="Imagem atual" className="w-full max-h-[320px] object-contain" />
                  ) : (
                    <div className="text-sm text-muted-foreground">Sem imagem</div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Imagem aprimorada</div>
                <div className="border rounded-lg p-2 bg-white">
                  {enhanceLoading ? (
                    <div className="text-sm text-muted-foreground">Processando...</div>
                  ) : enhancedPreview ? (
                    <img src={enhancedPreview} alt="Imagem aprimorada" className="w-full max-h-[320px] object-contain" />
                  ) : (
                    <div className="text-sm text-muted-foreground">Sem prévia</div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEnhanceOpen(false)}>
                Voltar
              </Button>
              <Button type="button" onClick={handleUseEnhanced} disabled={!enhancedPreview || enhanceLoading}>
                Usar imagem com IA
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Preço</div>
            <Tabs value={priceMode} onValueChange={(v) => setPriceMode(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="simple" className="h-7 text-xs">Simples</TabsTrigger>
                <TabsTrigger value="variants" className="h-7 text-xs">Variantes</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Tabs value={priceMode} onValueChange={(v) => setPriceMode(v as any)}>
            <TabsContent value="simple" className="mt-2">
              <div className="space-y-2">
                <Label htmlFor="price">Preço</Label>
                <Input
                  id="price"
                  type="text"
                  value={formatFromRaw(priceRaw)}
                  onChange={handlePriceChange}
                  placeholder="0,00"
                  required={priceMode === 'simple'}
                />
              </div>
            </TabsContent>
            <TabsContent value="variants" className="mt-2">
              <div className="space-y-3">
                 <div className="flex justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={handleAddPriceVariant}>
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar Tamanho
                    </Button>
                 </div>
                 
                 <DragDropContext onDragEnd={onPriceVariantsDragEnd}>
                    <Droppable droppableId="price-variants-list">
                        {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                {priceVariants.filter(v => !v._deleted).map((variant, index) => (
                                    <Draggable key={variant.id || `temp-${index}`} draggableId={variant.id || `temp-${index}`} index={index}>
                                        {(draggableProvided) => (
                                            <div
                                                ref={draggableProvided.innerRef}
                                                {...draggableProvided.draggableProps}
                                                className="flex items-center gap-2 p-2 border rounded-lg bg-white"
                                            >
                                                <div {...draggableProvided.dragHandleProps} className="cursor-grab text-gray-400">
                                                    <GripVertical className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <Input 
                                                        value={variant.name}
                                                        onChange={(e) => handlePriceVariantChange(index, 'name', e.target.value)}
                                                        placeholder="Ex: Pequena"
                                                        className="h-8"
                                                    />
                                                </div>
                                                <div className="w-24">
                                                    <Input 
                                                        type="number"
                                                        value={variant.price}
                                                        onChange={(e) => handlePriceVariantChange(index, 'price', parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                        className="h-8"
                                                        step="0.01"
                                                    />
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleRemovePriceVariant(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                 </DragDropContext>
                 
                 {priceVariants.filter(v => !v._deleted).length === 0 && (
                     <div className="text-sm text-center text-muted-foreground py-4 border border-dashed rounded-lg">
                         Nenhuma variante adicionada
                     </div>
                 )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="stock_quantity" className="text-boracume-orange">Estoque</Label>
            <Input
              id="stock_quantity"
              type="number"
              value={String(formData.stock_quantity ?? 0)}
              onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))}
              className="border-boracume-orange"
              disabled={!formData.track_stock}
              min={0}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="low_stock_threshold">Estoque mín.</Label>
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

        <div className="flex gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={() => toast({ title: 'Em breve' })}>+ Desconto</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => toast({ title: 'Em breve' })}>+ Custo</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => toast({ title: 'Em breve' })}>+ Embalagem</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => toast({ title: 'Em breve' })}>+ SKU</Button>
        </div>

        <div className="flex items-center justify-between py-2 border-t">
          <div className="text-sm font-semibold">Controle de estoque</div>
          <Switch
            id="track_stock"
            checked={formData.track_stock}
            onCheckedChange={async (checked) => {
              if (checked) {
                const ok = await checkStockSchema();
                if (!ok) return;
              }
              setFormData(prev => ({ ...prev, track_stock: checked }));
            }}
            disabled={false}
          />
        </div>

        {!stockSchemaSupported && (
          <div className="text-sm text-red-600 border rounded-lg p-3">
            Controle de estoque ainda não está habilitado no banco.
          </div>
        )}

        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Adicionar variações</div>
              <Badge variant="secondary">{selectedVariations.length}</Badge>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => setVariationsDialogOpen(true)} className="h-9 w-9">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">Ingredientes, sabores, talheres...</div>

          {selectedVariations.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-lg p-3">
              Nenhuma variação selecionada.
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="variations-list">
                {(provided) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="border rounded-lg divide-y"
                  >
                    {selectedVariations.map((id, index) => {
                      const v = globalVariations.find((gv: any) => gv.id === id);
                      if (!v) return null;
                      
                      return (
                        <Draggable key={id} draggableId={id} index={index}>
                          {(draggableProvided) => (
                            <div 
                              ref={draggableProvided.innerRef}
                              {...draggableProvided.draggableProps}
                              className="p-3 bg-white"
                            >
                              <div className="flex items-center gap-2">
                                <button 
                                  type="button"
                                  {...draggableProvided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </button>
                                <div className="flex-1 text-sm font-medium">{v.name}</div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setExpandedVariationId(prev => (prev === v.id ? null : v.id))}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>
                              {expandedVariationId === v.id && (
                                <div className="mt-3 flex gap-4 flex-wrap sm:flex-nowrap pl-7">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`required-${v.id}`}
                                      checked={variationSettings[v.id]?.required || false}
                                      onCheckedChange={(checked) => handleVariationSettingChange(v.id, 'required', checked as boolean)}
                                    />
                                    <Label htmlFor={`required-${v.id}`}>Obrigatório</Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`min-selections-${v.id}`}>Mín.</Label>
                                    <Input
                                      id={`min-selections-${v.id}`}
                                      type="number"
                                      min="0"
                                      value={variationSettings[v.id]?.min_selections ?? 0}
                                      onChange={e => handleVariationSettingChange(v.id, 'min_selections', parseInt(e.target.value) || 0)}
                                      className="w-14 min-w-[56px] text-center appearance-none"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`max-selections-${v.id}`}>Máx.</Label>
                                    <Input
                                      id={`max-selections-${v.id}`}
                                      type="number"
                                      min="1"
                                      value={variationSettings[v.id]?.max_selections ?? 1}
                                      onChange={e => handleVariationSettingChange(v.id, 'max_selections', parseInt(e.target.value) || 1)}
                                      className="w-14 min-w-[56px] text-center appearance-none"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        <Dialog open={variationsDialogOpen} onOpenChange={setVariationsDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Selecionar variações</DialogTitle>
            </DialogHeader>
            {globalVariations.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma variação global cadastrada.</div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
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
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={() => setVariationsDialogOpen(false)}>
                Concluir
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
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

        <div className="grid grid-cols-2 gap-4 pt-2">
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
    </div>
  );
};

export default ProductForm;
