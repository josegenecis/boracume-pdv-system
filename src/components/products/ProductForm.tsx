
import React, { useState, useEffect } from 'react';
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
import { ChevronDown, ChevronUp, GripVertical, MoreVertical, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';

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
  cost_price?: number;
  packaging_fee?: number;
  sku?: string;
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
    cost_price: 0,
    packaging_fee: 0,
    sku: '',
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
  const [showDiscount, setShowDiscount] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [showPackaging, setShowPackaging] = useState(false);
  const [showSku, setShowSku] = useState(false);
  const [costRaw, setCostRaw] = useState<string>(String(Math.round(((product as any)?.cost_price ?? 0) * 100)));
  const [packagingRaw, setPackagingRaw] = useState<string>(String(Math.round(((product as any)?.packaging_fee ?? 0) * 100)));
  const [skuValue, setSkuValue] = useState<string>(String((product as any)?.sku ?? ''));
  const [priceVariants, setPriceVariants] = useState<Array<{ id: string; name: string; priceRaw: string }>>([]);
  const [priceVariantVariationId, setPriceVariantVariationId] = useState<string | null>(null);

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
      const { data } = await invokeEdgeFunction<any>('enhance-product-image', { imageUrl: formData.image_url });
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
    if (!isUnsupported('cost_price')) baseData.cost_price = formData.cost_price;
    if (!isUnsupported('packaging_fee')) baseData.packaging_fee = formData.packaging_fee;
    if (!isUnsupported('sku')) baseData.sku = formData.sku;

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

  const rawToNumber = (raw: string) => {
    const cents = parseInt(raw || '0', 10) || 0;
    return cents / 100;
  };

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      cost_price: rawToNumber(costRaw),
      packaging_fee: rawToNumber(packagingRaw),
      sku: skuValue
    }));
  }, [costRaw, packagingRaw, skuValue]);

  useEffect(() => {
    setShowDiscount(!!(product as any)?.original_price || !!(product as any)?.discount_percentage);
    setShowCost((product as any)?.cost_price !== undefined && Number((product as any)?.cost_price) > 0);
    setShowPackaging((product as any)?.packaging_fee !== undefined && Number((product as any)?.packaging_fee) > 0);
    setShowSku(!!(product as any)?.sku);
  }, [product?.id]);

  const moveSelectedVariation = (variationId: string, dir: -1 | 1) => {
    setSelectedVariations(prev => {
      const idx = prev.indexOf(variationId);
      if (idx === -1) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = tmp;
      return copy;
    });
  };

  const addPriceVariantRow = () => {
    setPriceVariants(prev => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name: '', priceRaw: '0' }
    ]);
  };

  const movePriceVariantRow = (rowId: string, dir: -1 | 1) => {
    setPriceVariants(prev => {
      const idx = prev.findIndex(r => r.id === rowId);
      if (idx === -1) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = tmp;
      return copy;
    });
  };

  useEffect(() => {
    if (priceMode !== 'variants') return;
    if (priceVariants.length > 0) return;
    setPriceVariants([
      { id: `${Date.now()}-p`, name: 'P', priceRaw: '0' },
      { id: `${Date.now()}-g`, name: 'G', priceRaw: '0' },
      { id: `${Date.now()}-gg`, name: 'GG', priceRaw: '0' },
    ]);
  }, [priceMode]);

  const loadPriceVariantVariation = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .select('id, name, options, required, max_selections')
        .eq('product_id', productId);
      if (error) return;
      const list: any[] = Array.isArray(data) ? data : [];
      const found = list.find((v: any) => {
        const name = String(v?.name || '').toLowerCase();
        const rawOpts = v?.options;
        const opts = Array.isArray(rawOpts) ? rawOpts : (typeof rawOpts === 'string' ? (() => { try { return JSON.parse(rawOpts); } catch { return []; } })() : []);
        return name === 'tamanho' || (Array.isArray(opts) && opts.some((o: any) => o?.is_price_variant === true));
      });
      if (!found) {
        setPriceVariantVariationId(null);
        return;
      }
      const rawOpts = found.options;
      const opts = Array.isArray(rawOpts) ? rawOpts : (typeof rawOpts === 'string' ? (() => { try { return JSON.parse(rawOpts); } catch { return []; } })() : []);
      const base = Number(formData.price) || Number((product as any)?.price) || 0;
      const rows = (opts || [])
        .filter((o: any) => o?.name)
        .map((o: any) => {
          const abs = base + (Number(o?.price) || 0);
          return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name: String(o.name), priceRaw: String(Math.round(abs * 100)) };
        });
      if (rows.length > 0) {
        setPriceVariantVariationId(String(found.id));
        setPriceVariants(rows);
        setPriceMode('variants');
      }
    } catch {}
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
        loadPriceVariantVariation(product.id);
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


    const hasCategory = !!formData.category_id || !!String(formData.category || '').trim();

    let effectivePrice = formData.price;
    let priceVariantOptions: any[] | null = null;

    if (priceMode === 'variants') {
      const cleaned = priceVariants
        .map(v => ({
          name: String(v.name || '').trim(),
          abs: rawToNumber(v.priceRaw)
        }))
        .filter(v => v.name && v.abs > 0);

      if (cleaned.length === 0) {
        toast({
          title: "Erro",
          description: "Adicione pelo menos 1 variante com nome e preço.",
          variant: "destructive"
        });
        return;
      }

      const base = Math.min(...cleaned.map(v => v.abs));
      effectivePrice = base;
      priceVariantOptions = cleaned.map(v => ({
        name: v.name,
        price: Math.max(0, Number((v.abs - base).toFixed(2))),
        is_price_variant: true
      }));
    }

    if (!user?.id || !String(formData.name || '').trim() || !hasCategory || effectivePrice <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios (nome, categoria e preço).",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const baseData = buildBaseData();
      baseData.price = effectivePrice;
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
        if (!formData.category_id) {
          toast({
            title: "Categoria obrigatória",
            description: "Selecione uma categoria para criar o produto.",
            variant: "destructive"
          });
          return;
        }
        const minimalData = {
          user_id: user.id,
          name: formData.name.trim(),
          price: effectivePrice,
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
      // Salvar vínculos de variações globais após salvar produto
      if (productId) {
        await saveProductVariations(productId);
      }

      if (productId) {
        if (priceMode === 'variants' && priceVariantOptions) {
          const rowData: any = {
            product_id: productId,
            user_id: user.id,
            name: 'Tamanho',
            price: 0,
            required: true,
            max_selections: 1,
            options: priceVariantOptions,
            updated_at: new Date().toISOString()
          };

          if (priceVariantVariationId) {
            await supabase.from('product_variations').update(rowData).eq('id', priceVariantVariationId);
          } else {
            const { data: inserted } = await supabase
              .from('product_variations')
              .insert([{ ...rowData, created_at: new Date().toISOString() } as any])
              .select('id')
              .single();
            if (inserted?.id) setPriceVariantVariationId(String(inserted.id));
          }
        }

        if (priceMode === 'simple' && priceVariantVariationId) {
          await supabase.from('product_variations').delete().eq('id', priceVariantVariationId);
          setPriceVariantVariationId(null);
          setPriceVariants([]);
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
        
        const linksWithOrder = variations.map((variationId, idx) => ({
          product_id: productId,
          global_variation_id: variationId,
          display_order: idx
        })) as any[];
        
        let data: any = null;
        let error: any = null;
        console.log('💾 Inserindo vínculos no banco:', linksWithOrder);
        const r1 = await supabase.from('product_global_variation_links').insert(linksWithOrder);
        data = (r1 as any).data;
        error = (r1 as any).error;

        if (error) {
          const msg = String(error?.message || error?.details || '');
          if (msg.includes('display_order') || msg.includes("Could not find the 'display_order' column")) {
            const links = variations.map(variationId => ({
              product_id: productId,
              global_variation_id: variationId
            }));
            const r2 = await supabase.from('product_global_variation_links').insert(links as any);
            data = (r2 as any).data;
            error = (r2 as any).error;
          }
        }
          
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
                  required
                />
              </div>
            </TabsContent>
            <TabsContent value="variants" className="mt-2">
              <div className="space-y-3 border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Tamanhos / Variantes</div>
                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={addPriceVariantRow}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                <div className="space-y-2">
                  {priceVariants.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                      <Input
                        value={row.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPriceVariants(prev => prev.map(r => r.id === row.id ? { ...r, name: v } : r));
                        }}
                        placeholder="Ex: P, G, GG"
                      />
                      <Input
                        value={formatFromRaw(row.priceRaw)}
                        onChange={(e) => {
                          const raw = (e.target.value || '').replace(/\D/g, '') || '0';
                          setPriceVariants(prev => prev.map(r => r.id === row.id ? { ...r, priceRaw: raw } : r));
                        }}
                        placeholder="0,00"
                      />
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === 0} onClick={() => movePriceVariantRow(row.id, -1)}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === priceVariants.length - 1} onClick={() => movePriceVariantRow(row.id, 1)}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPriceVariants(prev => prev.filter(r => r.id !== row.id))}
                          disabled={priceVariants.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  O menor preço vira o preço base do produto. Os demais são calculados como diferença.
                </div>
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
          <Button type="button" variant="outline" size="sm" onClick={() => setShowDiscount(v => !v)}>+ Desconto</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowCost(v => !v)}>+ Custo</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowPackaging(v => !v)}>+ Embalagem</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowSku(v => !v)}>+ SKU</Button>
        </div>

        {showDiscount && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="original_price">Preço original</Label>
              <Input
                id="original_price"
                value={formatFromRaw(originalPriceRaw)}
                onChange={handleOriginalPriceChange}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label>Desconto (%)</Label>
              <Input value={String(formData.discount_percentage ?? 0)} readOnly className="bg-gray-50" />
            </div>
          </div>
        )}

        {showCost && (
          <div className="space-y-1">
            <Label>Custo</Label>
            <Input
              value={formatFromRaw(costRaw)}
              onChange={(e) => {
                const raw = (e.target.value || '').replace(/\D/g, '') || '0';
                setCostRaw(raw);
              }}
              placeholder="0,00"
            />
          </div>
        )}

        {showPackaging && (
          <div className="space-y-1">
            <Label>Embalagem</Label>
            <Input
              value={formatFromRaw(packagingRaw)}
              onChange={(e) => {
                const raw = (e.target.value || '').replace(/\D/g, '') || '0';
                setPackagingRaw(raw);
              }}
              placeholder="0,00"
            />
          </div>
        )}

        {showSku && (
          <div className="space-y-1">
            <Label>SKU</Label>
            <Input value={skuValue} onChange={(e) => setSkuValue(e.target.value)} placeholder="Código interno" />
          </div>
        )}

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
            <div className="border rounded-lg divide-y">
              {selectedVariations
                .map((id) => globalVariations.find((v: any) => v.id === id))
                .filter(Boolean)
                .map((v: any, idx: number) => (
                  <div key={v.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 text-sm font-medium">{v.name}</div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === 0} onClick={() => moveSelectedVariation(v.id, -1)}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === selectedVariations.length - 1} onClick={() => moveSelectedVariation(v.id, 1)}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
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
                      <div className="mt-3 flex gap-4 flex-wrap sm:flex-nowrap">
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
                ))}
            </div>
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
