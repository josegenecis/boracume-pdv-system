import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Facebook, Image as ImageIcon, Loader2, MapPin, Megaphone, RefreshCw, Send, ShieldCheck, Sparkles, Upload, Wand2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { callPopMarketingAI } from '@/services/popMarketingAiService';
import { normalizeImageUrlForDisplay } from '@/utils/normalizeImageUrl';
import { ensureStorageSetup } from '@/utils/storageSetup';
import { compressImageFileToMaxBytes } from '@/utils/imageCompression';
import AdjustableImageDialog from '@/components/media/AdjustableImageDialog';

type Product = { id: string; name: string; price: number; image_url?: string | null; category?: string | null };
type MetaConnection = {
  id: string;
  status: string;
  business_id?: string | null;
  ad_account_id?: string | null;
  page_id?: string | null;
  instagram_account_id?: string | null;
  whatsapp_business_account_id?: string | null;
  phone_number_id?: string | null;
  currency?: string | null;
  timezone?: string | null;
  assets_json?: any;
};
type Campaign = {
  id: string;
  name: string;
  status: string;
  destination: string;
  daily_budget: number;
  product_focus?: string | null;
  target_city?: string | null;
  target_radius_km?: number | null;
  created_at: string;
  ai_strategy?: any;
  review_snapshot?: any;
  meta_campaign_id?: string | null;
};
type Creative = {
  id?: string;
  format: 'feed_1080x1080' | 'story_1080x1920' | 'reels_1080x1920' | 'banner_1200x628';
  image_url?: string | null;
  logo_url?: string | null;
  generated_image_prompt?: string | null;
  source_product_image_url?: string | null;
  variation?: string | null;
  mode?: 'professional' | 'full_ai' | string | null;
  warning?: string | null;
  headline?: string | null;
  primary_text?: string | null;
  description?: string | null;
  cta?: string | null;
  type?: string | null;
};

const statusLabel: Record<string, string> = {
  draft: 'Rascunho',
  review: 'Revisão',
  approved: 'Aprovada',
  publishing: 'Publicando',
  paused: 'Pausada na Meta',
  active: 'Ativa',
  error: 'Erro',
};

function money(value: unknown) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function dateLabel(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const creativeFormatOptions = [
  { id: 'feed_1080x1080', label: 'Feed', description: 'Quadrado 1:1' },
  { id: 'story_1080x1920', label: 'Stories', description: 'Vertical 9:16' },
  { id: 'reels_1080x1920', label: 'Reels', description: 'Vertical 9:16' },
  { id: 'banner_1200x628', label: 'Horizontal', description: 'Facebook 1.91:1' },
] as const;

const placementOptions = [
  { id: 'facebook_feed', label: 'Facebook Feed' },
  { id: 'instagram_feed', label: 'Instagram Feed' },
  { id: 'instagram_stories', label: 'Stories' },
  { id: 'instagram_reels', label: 'Reels' },
  { id: 'facebook_stories', label: 'Facebook Stories' },
] as const;

const formatAspectClass: Record<Creative['format'], string> = {
  feed_1080x1080: 'aspect-square',
  story_1080x1920: 'aspect-[9/16] max-h-[680px]',
  reels_1080x1920: 'aspect-[9/16] max-h-[680px]',
  banner_1200x628: 'aspect-[1200/628]',
};

export default function PopMarketingAI() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connection, setConnection] = useState<MetaConnection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [selectedCopyIndex, setSelectedCopyIndex] = useState(0);
  const [selectedCreativeId, setSelectedCreativeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [uploadingCreativeKey, setUploadingCreativeKey] = useState<string | null>(null);
  const [pendingCreativeImage, setPendingCreativeImage] = useState<{ creative: Creative; key: string; file: File } | null>(null);
  const [form, setForm] = useState({
    objective: 'vender_mais',
    destination: 'whatsapp',
    productId: 'none',
    productFocus: '',
    dailyBudget: 20,
    targetCity: '',
    targetRadiusKm: 5,
    startDate: '',
    endDate: '',
    notes: '',
    selectedFormats: ['feed_1080x1080', 'story_1080x1920', 'reels_1080x1920'],
    selectedPlacements: ['facebook_feed', 'instagram_feed', 'instagram_stories', 'instagram_reels'],
  });

  const selectedProduct = useMemo(() => products.find((item) => item.id === form.productId) || null, [form.productId, products]);
  const selectedCampaignProduct = selectedCampaign?.ai_strategy?.product || null;
  const toggleFormArray = (key: 'selectedFormats' | 'selectedPlacements', value: string) => {
    setForm((prev) => {
      const current = new Set(prev[key]);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      if (key === 'selectedFormats' && current.size === 0) current.add('feed_1080x1080');
      return { ...prev, [key]: [...current] };
    });
  };
  const permissionNames = useMemo(
    () => new Set((connection?.assets_json?.permissions || []).filter((item: any) => item?.status === 'granted').map((item: any) => item.permission)),
    [connection?.assets_json]
  );
  const metaAssetStatus = useMemo(() => ({
    instagram: connection?.instagram_account_id
      ? connection.instagram_account_id
      : permissionNames.has('instagram_basic')
        ? 'não vinculado'
        : 'permissão pendente',
    whatsapp: connection?.whatsapp_business_account_id
      ? connection.whatsapp_business_account_id
      : permissionNames.has('whatsapp_business_management')
        ? 'não vinculado'
        : 'permissão pendente',
    phone: connection?.phone_number_id
      ? connection.phone_number_id
      : permissionNames.has('whatsapp_business_management')
        ? 'não localizado'
        : 'permissão pendente',
  }), [connection, permissionNames]);

  useEffect(() => {
    if (!user?.id) return;
    void loadAll();
    void handleMetaCallback();
  }, [user?.id]);

  const loadAll = async () => {
    await Promise.all([loadConnection(), loadProducts(), loadCampaigns()]);
  };

  const handleMetaCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const isCallback = params.get('meta_callback') === '1';
    if (!code || !isCallback) return;
    setLoading(true);
    try {
      const result = await callPopMarketingAI<{ connection: MetaConnection }>({ action: 'complete_oauth', code });
      setConnection(result.connection);
      params.delete('code');
      params.delete('state');
      params.delete('meta_callback');
      params.set('tab', 'pop-ai');
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      toast({ title: 'Meta conectada', description: 'Conta de anúncios e ativos sincronizados.' });
    } catch (error: any) {
      toast({ title: 'Erro ao conectar Meta', description: error?.message || 'Confira as credenciais do app Meta.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadConnection = async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any)
      .from('meta_connections')
      .select('id,status,business_id,ad_account_id,page_id,instagram_account_id,whatsapp_business_account_id,phone_number_id,currency,timezone,assets_json,last_sync_at')
      .eq('restaurant_id', user.id)
      .maybeSingle();
    setConnection(data || null);
  };

  const loadProducts = async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any)
      .from('products')
      .select('id,name,price,image_url,category')
      .eq('user_id', user.id)
      .eq('available', true)
      .order('name')
      .limit(250);
    setProducts(data || []);
  };

  const loadCampaigns = async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any)
      .from('marketing_campaigns')
      .select('*')
      .eq('restaurant_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setCampaigns(data || []);
    if (!selectedCampaign && data?.[0]) void openCampaign(data[0]);
  };

  const connectMeta = async () => {
    setLoading(true);
    try {
      const result = await callPopMarketingAI<{ url: string }>({ action: 'start_oauth' });
      window.location.href = result.url;
    } catch (error: any) {
      toast({ title: 'Meta não configurada', description: error?.message || 'Configure META_APP_ID e META_APP_SECRET.', variant: 'destructive' });
      setLoading(false);
    }
  };

  const syncAssets = async () => {
    setLoading(true);
    try {
      const result = await callPopMarketingAI<{ connection: MetaConnection }>({ action: 'sync_assets' });
      setConnection(result.connection);
      toast({ title: 'Contas conectadas atualizadas', description: 'Facebook, Instagram e WhatsApp foram sincronizados.' });
    } catch (error: any) {
      toast({ title: 'Erro ao sincronizar', description: error?.message || 'Tente reconectar a Meta.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    setGenerationError(null);

    if (form.productId === 'none' && !form.productFocus.trim()) {
      const message = 'Selecione um produto ou informe o nome de um produto/categoria.';
      setGenerationError(message);
      toast({ title: 'Informe o que será anunciado', description: message, variant: 'destructive' });
      return;
    }

    if (selectedProduct && !selectedProduct.image_url) {
      const message = `O produto ${selectedProduct.name} ainda não possui uma foto cadastrada.`;
      setGenerationError(message);
      toast({ title: 'Foto do produto necessária', description: message, variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        action: 'plan_campaign',
        ...form,
        productId: form.productId === 'none' ? null : form.productId,
        productFocus: selectedProduct?.name || form.productFocus,
      };
      const result = await callPopMarketingAI<any>(payload);
      toast({ title: 'Campanha criada para revisão', description: 'A IA gerou estratégia, copys e criativos.' });
      await loadCampaigns();
      if (result?.campaignId) {
        const { data } = await (supabase as any).from('marketing_campaigns').select('*').eq('id', result.campaignId).single();
        if (data) await openCampaign(data);
      }
    } catch (error: any) {
      const message = error?.message || 'Não foi possível gerar o plano.';
      setGenerationError(message);
      toast({ title: 'Erro ao gerar campanha', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const replaceCreativeImage = async (creative: Creative, key: string, file?: File | null) => {
    if (!user?.id || !selectedCampaign?.id || !file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Tipo de arquivo inválido', description: 'Use JPEG, PNG, WebP ou GIF.', variant: 'destructive' });
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Tente uma imagem menor para processar no navegador.', variant: 'destructive' });
      return;
    }

    setUploadingCreativeKey(key);
    try {
      const setup = await ensureStorageSetup();
      if (!setup.success) throw new Error(setup.message || 'Storage não configurado.');

      const prepared = file.size > 100 * 1024
        ? await compressImageFileToMaxBytes(file, { maxBytes: 100 * 1024, maxDimension: 1800, preferMimeType: 'image/webp' })
        : file;
      const ext = String(prepared.name.split('.').pop() || 'webp').toLowerCase();
      const path = `marketing-ai/source-photos/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, prepared, { contentType: prepared.type, upsert: true } as any);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      const sourceImageUrl = data.publicUrl;
      const result = await callPopMarketingAI<{ creative: Creative }>({
        action: 'rerender_creative',
        campaignId: selectedCampaign.id,
        creativeId: creative.id || null,
        format: creative.format,
        variation: creative.variation || null,
        sourceImageUrl,
        copyIndex: selectedCopyIndex,
      });

      const updated = result.creative;
      setCreatives((prev) => prev.map((item, index) => {
        const itemKey = item.id || `${item.format}-${item.variation || index}`;
        const matches = itemKey === key || (updated?.id && item.id === updated.id);
        return matches ? { ...item, ...updated } : item;
      }));
      if (updated?.id) setSelectedCreativeId(updated.id);
      toast({ title: 'Imagem trocada', description: 'Esse criativo foi refeito com a nova foto.' });
    } catch (error: any) {
      toast({ title: 'Erro ao trocar imagem', description: error?.message || 'Não foi possível refazer o criativo.', variant: 'destructive' });
    } finally {
      setUploadingCreativeKey(null);
    }
  };

  const getCreativeOutputSize = (format?: string | null) => {
    const normalized = String(format || '').toLowerCase();
    if (normalized.includes('1920') || normalized.includes('story') || normalized.includes('reels')) {
      return { width: 1080, height: 1920, aspect: 1080 / 1920 };
    }
    if (normalized.includes('1200') || normalized.includes('banner') || normalized.includes('horizontal') || normalized.includes('facebook')) {
      return { width: 1200, height: 628, aspect: 1200 / 628 };
    }
    return { width: 1080, height: 1080, aspect: 1 };
  };

  const openCampaign = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setSelectedCopyIndex(0);
    const { data } = await (supabase as any)
      .from('marketing_creatives')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('format');
    const snapshotCreatives = campaign.review_snapshot?.creatives || [];
    const list = Array.isArray(data) && data.length > 0
      ? data.map((row: Creative) => {
        const snapshot = snapshotCreatives.find((item: Creative) => item.image_url && item.image_url === row.image_url);
        return snapshot ? { ...snapshot, ...row } : row;
      })
      : snapshotCreatives;
    setCreatives(list);
    setSelectedCreativeId(list?.[0]?.id || null);
  };

  const publishPaused = async () => {
    if (!selectedCampaign?.id) return;
    setLoading(true);
    try {
      await callPopMarketingAI({ action: 'publish_paused', campaignId: selectedCampaign.id, copyIndex: selectedCopyIndex, creativeId: selectedCreativeId });
      toast({ title: 'Campanha enviada pausada', description: 'Ela foi criada na Meta como PAUSED para revisão final.' });
      await loadCampaigns();
    } catch (error: any) {
      toast({ title: 'Não foi possível publicar', description: error?.message || 'Confira permissões, página e conta de anúncio.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {pendingCreativeImage ? (
        <AdjustableImageDialog
          open
          file={pendingCreativeImage.file}
          title={`Ajustar imagem do criativo ${pendingCreativeImage.creative.format}`}
          aspectRatio={getCreativeOutputSize(pendingCreativeImage.creative.format).aspect}
          outputWidth={getCreativeOutputSize(pendingCreativeImage.creative.format).width}
          outputHeight={getCreativeOutputSize(pendingCreativeImage.creative.format).height}
          onCancel={() => setPendingCreativeImage(null)}
          onConfirm={(file) => {
            const current = pendingCreativeImage;
            setPendingCreativeImage(null);
            void replaceCreativeImage(current.creative, current.key, file);
          }}
        />
      ) : null}
      <Card className="overflow-hidden border-0 bg-[#062f23] text-white shadow-xl">
        <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.28em] text-[#d9ff99]">
              <Sparkles className="h-4 w-4" /> Anúncios Automáticos
            </div>
            <h2 className="text-3xl font-black">Crie anúncios para Facebook e Instagram em poucos cliques</h2>
            <p className="mt-2 max-w-3xl text-white/78">
              Conecte suas contas, escolha o que deseja divulgar e o PopSystem ajuda a criar sua propaganda de forma simples.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={connectMeta} disabled={loading} className="bg-[#ff5a00] text-white hover:bg-[#e75000]">
              <Facebook className="mr-2 h-4 w-4" /> Conectar Facebook e Instagram
            </Button>
            <Button onClick={syncAssets} disabled={loading || !connection} variant="secondary">
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar contas conectadas
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-[#ff5a00]" /> Criar propaganda com IA</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>O que você deseja?</Label>
              <Select value={form.objective} onValueChange={(v) => setForm((p) => ({ ...p, objective: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vender_mais">Vender mais</SelectItem>
                  <SelectItem value="divulgar_promocao">Divulgar promoção</SelectItem>
                  <SelectItem value="aumentar_pedidos">Receber pedidos no WhatsApp</SelectItem>
                  <SelectItem value="recuperar_clientes">Atrair novos clientes</SelectItem>
                  <SelectItem value="produto_especifico">Divulgar produto específico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Para onde o cliente vai?</Label>
              <Select value={form.destination} onValueChange={(v) => setForm((p) => ({ ...p, destination: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="menu">Cardápio digital</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>O que deseja anunciar?</Label>
              <select
                value={form.productId}
                onChange={(event) => {
                  const productId = event.target.value;
                  const product = products.find((item) => item.id === productId);
                  setGenerationError(null);
                  setForm((previous) => ({
                    ...previous,
                    productId,
                    productFocus: product?.name || previous.productFocus,
                  }));
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Produto que será anunciado"
              >
                <option value="none">PopSystem escolhe pelo nome ou categoria</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {money(product.price)}{product.image_url ? '' : ' (sem foto)'}
                  </option>
                ))}
              </select>
              {selectedProduct ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                  {selectedProduct.image_url ? (
                    <img
                      src={normalizeImageUrlForDisplay(selectedProduct.image_url)}
                      alt={selectedProduct.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-lg bg-white"><ImageIcon className="h-5 w-5" /></div>
                  )}
                  <div>
                    <div className="font-bold">Produto selecionado: {selectedProduct.name}</div>
                    <div className="text-xs">{selectedProduct.image_url ? 'Foto pronta para os criativos.' : 'Cadastre uma foto antes de gerar.'}</div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Digite o produto ou categoria</Label>
              <Input value={form.productFocus} onChange={(e) => {
                setGenerationError(null);
                setForm((p) => ({ ...p, productFocus: e.target.value }));
              }} placeholder="Ex.: hambúrguer, pizza, açaí, combo família" />
            </div>
            <div className="space-y-2">
              <Label>Quanto deseja investir por dia?</Label>
              <Input type="number" min={5} value={form.dailyBudget} onChange={(e) => setForm((p) => ({ ...p, dailyBudget: Number(e.target.value || 0) }))} />
            </div>
            <div className="space-y-2">
              <Label>Até quantos km do restaurante mostrar?</Label>
              <Input type="number" min={1} value={form.targetRadiusKm} onChange={(e) => setForm((p) => ({ ...p, targetRadiusKm: Number(e.target.value || 0) }))} />
              <p className="text-xs text-muted-foreground">Seu anúncio será mostrado para pessoas próximas ao restaurante.</p>
            </div>
            <div className="space-y-2">
              <Label>Cidade alvo</Label>
              <Input value={form.targetCity} onChange={(e) => setForm((p) => ({ ...p, targetCity: e.target.value }))} placeholder="Ex.: Fortaleza" />
            </div>
            <div className="space-y-2">
              <Label>Data final</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
            </div>
            <div className="space-y-3 md:col-span-2">
              <div>
                <Label>Direção de arte dos criativos</Label>
                <p className="text-xs text-muted-foreground">
                  O PopSystem usa modelos profissionais com foto real do produto. Não há geração de imagem por IA no fluxo principal.
                </p>
              </div>
              <div className="grid gap-3 rounded-2xl border bg-[#fbfaf6] p-4 sm:grid-cols-2">
                <div className="rounded-xl border bg-white p-3">
                  <div className="font-bold text-[#003223]">Foto real obrigatória</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {selectedProduct?.image_url ? 'O produto selecionado tem imagem cadastrada.' : 'Selecione um produto com foto cadastrada para montar os criativos.'}
                  </div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="font-bold text-[#003223]">Modelos automáticos</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Feed, Stories, Reels e Horizontal são montados com logo, foto, chamada, preço e botão.
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3 md:col-span-2">
              <div>
                <Label>Formatos dos criativos</Label>
                <p className="text-xs text-muted-foreground">Escolha os tamanhos que serão gerados com arte final independente.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {creativeFormatOptions.map((option) => {
                  const active = form.selectedFormats.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleFormArray('selectedFormats', option.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-[#8CC850] bg-[#f2ffe8] ring-2 ring-[#8CC850]/20' : 'border-border bg-white hover:border-[#8CC850]'}`}
                    >
                      <Checkbox checked={active} className="mt-1" />
                      <span>
                        <span className="flex items-center gap-2 font-bold">
                          <ImageIcon className="h-4 w-4 text-[#ff5a00]" />
                          Montar {option.label}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3 md:col-span-2">
              <div>
                <Label>Posicionamentos</Label>
                <p className="text-xs text-muted-foreground">Use os canais onde essa campanha deve rodar. A Meta receberá a campanha pausada para revisão.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {placementOptions.map((option) => {
                  const active = form.selectedPlacements.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleFormArray('selectedPlacements', option.id)}
                      className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${active ? 'border-[#8CC850] bg-[#f2ffe8] text-[#003223]' : 'border-border bg-white text-muted-foreground hover:border-[#8CC850]'}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações para IA</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Ex.: destacar entrega rápida, promoção só hoje, evitar prometer tempo exato..." />
            </div>
            <div className="md:col-span-2">
              {generationError ? (
                <Alert className="mb-3 border-red-200 bg-red-50 text-red-900">
                  <AlertTitle>Não foi possível gerar</AlertTitle>
                  <AlertDescription>{generationError}</AlertDescription>
                </Alert>
              ) : null}
              <Button onClick={generatePlan} disabled={loading} className="w-full bg-[#ff5a00] text-white hover:bg-[#e75000]">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {loading ? 'Gerando campanha e criativos...' : 'Gerar campanha para revisão'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Facebook e Instagram</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <Badge className={connection?.status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-700'}>{connection?.status === 'connected' ? 'conectado' : 'não conectado'}</Badge>
            </div>
            <div>Conta: <strong>{connection?.ad_account_id || 'não vinculada'}</strong></div>
            <div>Página: <strong>{connection?.page_id || 'não vinculada'}</strong></div>
            <div>Instagram: <strong>{metaAssetStatus.instagram}</strong></div>
            <div>WhatsApp Ads: <strong>{metaAssetStatus.whatsapp}</strong></div>
            <div>Número WABA: <strong>{metaAssetStatus.phone}</strong></div>
            <div>Moeda/Fuso: <strong>{connection?.currency || '-'} / {connection?.timezone || '-'}</strong></div>
            {(connection?.assets_json?.warnings || []).length > 0 && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertTitle>Permissões Meta pendentes</AlertTitle>
                <AlertDescription>
                  A conta pode estar vinculada na Meta, mas este app ainda não recebeu permissão para consultar todos os ativos.
                </AlertDescription>
              </Alert>
            )}
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Segurança</AlertTitle>
              <AlertDescription>
                A primeira versão sempre cria campanha em revisão/pausada. Nada é publicado ativo sem aprovação.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Campanhas recentes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {campaigns.length === 0 ? (
              <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">Nenhuma campanha criada ainda.</div>
            ) : campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => openCampaign(campaign)}
                className={`w-full rounded-xl border p-3 text-left transition hover:border-[#ff5a00] ${selectedCampaign?.id === campaign.id ? 'border-[#ff5a00] bg-orange-50' : 'border-border bg-white'}`}
              >
                <div className="font-bold">{campaign.name}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{campaign.product_focus || campaign.destination}</span>
                  <Badge variant="outline">{statusLabel[campaign.status] || campaign.status}</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Painel de revisão</CardTitle>
              <Button onClick={publishPaused} disabled={loading || !selectedCampaign} className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Send className="mr-2 h-4 w-4" /> Publicar pausada
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedCampaign ? (
              <div className="rounded-xl bg-muted p-8 text-center text-muted-foreground">Selecione ou gere uma campanha para revisar.</div>
            ) : (
              <Tabs defaultValue="overview">
                <TabsList className="mb-4">
                  <TabsTrigger value="overview">Resumo</TabsTrigger>
                  <TabsTrigger value="copy">Textos</TabsTrigger>
                  <TabsTrigger value="creative">Artes</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl bg-muted p-4"><div className="text-xs text-muted-foreground">Status</div><div className="font-black">{statusLabel[selectedCampaign.status] || selectedCampaign.status}</div></div>
                    <div className="rounded-xl bg-muted p-4"><div className="text-xs text-muted-foreground">Investimento por dia</div><div className="font-black">{money(selectedCampaign.daily_budget)}</div></div>
                    <div className="rounded-xl bg-muted p-4"><div className="text-xs text-muted-foreground">Destino</div><div className="font-black">{selectedCampaign.destination}</div></div>
                    <div className="rounded-xl bg-muted p-4"><div className="text-xs text-muted-foreground">Criada</div><div className="font-black">{dateLabel(selectedCampaign.created_at)}</div></div>
                  </div>
                  <div className="rounded-xl border bg-emerald-50 p-4 text-sm text-emerald-950">
                    <div className="flex items-center gap-2 font-bold">
                      <MapPin className="h-4 w-4" /> Raio de cobertura
                    </div>
                    <p className="mt-1">
                      {selectedCampaign.ai_strategy?.audience?.origin?.formatted_address
                        ? `Anúncio configurado para ${selectedCampaign.ai_strategy?.audience?.radius_km || selectedCampaign.target_radius_km || 5} km a partir de ${selectedCampaign.ai_strategy.audience.origin.formatted_address}.`
                        : `Ainda não encontramos a localização exata. Confira o endereço do restaurante antes de publicar.`}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#062f23] p-4 text-sm text-white">
                    <div className="font-bold">Estratégia da campanha</div>
                    <p className="mt-2 text-white/80">
                      O PopSystem preparou textos, público recomendado, raio de entrega da propaganda e canais indicados para revisão.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="copy" className="grid gap-3 md:grid-cols-2">
                  {(selectedCampaign.ai_strategy?.copies || []).map((copy: any, index: number) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedCopyIndex(index)}
                      className={`rounded-xl border p-4 text-left transition hover:border-[#ff5a00] ${selectedCopyIndex === index ? 'border-[#8CC850] bg-[#f7fff0] ring-2 ring-[#8CC850]/40' : 'bg-white'}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge className="bg-[#ff5a00] text-white">{copy.style || `Variação ${index + 1}`}</Badge>
                        {selectedCopyIndex === index && <Badge className="bg-[#8CC850] text-[#003223]">Selecionada</Badge>}
                      </div>
                      <div className="font-bold">{copy.headline}</div>
                      <p className="mt-2 text-sm text-muted-foreground">{copy.primary_text}</p>
                      <p className="mt-2 text-xs">{copy.description}</p>
                    </button>
                  ))}
                  <div className="md:col-span-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                    A copy marcada como selecionada será usada na publicação pausada da Meta.
                  </div>
                </TabsContent>
                <TabsContent value="creative" className="grid gap-4 md:grid-cols-2">
                  {creatives.map((creative, index) => {
                    const productName = selectedCampaignProduct?.name || selectedCampaign.product_focus || 'Oferta especial';
                    const imageUrl = normalizeImageUrlForDisplay(creative.image_url);
                    const key = creative.id || `${creative.format}-${creative.variation || index}`;
                    const selected = selectedCreativeId === key || selectedCreativeId === creative.id;
                    const uploadInputId = `creative-image-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                    const uploadingThis = uploadingCreativeKey === key;
                    return (
                      <div key={key} className={`rounded-xl border bg-white p-3 transition ${selected ? 'border-[#8CC850] ring-2 ring-[#8CC850]/35' : 'border-border'}`}>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <strong>{creative.format}</strong>
                              {creative.variation && <Badge className="bg-[#ff5a00] text-white">Versão {creative.variation}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">{creativeFormatOptions.find((item) => item.id === creative.format)?.description || 'Criativo final'}</div>
                          </div>
                          <Badge className={creative.mode === 'professional' ? 'bg-[#f2ffe8] text-[#003223]' : 'bg-amber-50 text-amber-800'}>
                            {creative.mode === 'template_real_photo' ? 'Template com foto real' : 'Foto real preservada'}
                          </Badge>
                        </div>
                        <div className={`mx-auto overflow-hidden rounded-lg border bg-[#f8f6ef] ${formatAspectClass[creative.format] || 'aspect-square'}`}>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={`${productName} - ${creative.format}`}
                              className="h-full w-full object-contain"
                              onError={(event) => { event.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                              <Sparkles className="mb-3 h-10 w-10 text-[#ff5a00]" />
                              <strong className="text-[#003223]">Criativo aguardando imagem</strong>
                              <span className="mt-2 text-sm">Cadastre uma foto real do produto e gere a campanha novamente.</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                          Essa é a imagem final que será enviada para a Meta no modo pausado. A copy selecionada na aba Copys será usada junto com este criativo.
                          {creative.warning && <strong className="mt-2 block text-amber-700">{creative.warning}</strong>}
                        </div>
                        <input
                          id={uploadInputId}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            event.currentTarget.value = '';
                            if (file) setPendingCreativeImage({ creative, key, file });
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={loading || uploadingThis}
                          onClick={() => document.getElementById(uploadInputId)?.click()}
                          className="mt-3 w-full"
                        >
                          {uploadingThis ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refazendo criativo...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" /> Trocar imagem deste criativo
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant={selected ? 'default' : 'outline'}
                          onClick={() => setSelectedCreativeId(key)}
                          className={`mt-3 w-full ${selected ? 'bg-[#8CC850] text-[#003223] hover:bg-[#7bbb42]' : ''}`}
                        >
                          {selected ? 'Criativo selecionado' : 'Selecionar este criativo'}
                        </Button>
                      </div>
                    );
                  })}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Campanha pronta para sua revisão</AlertTitle>
        <AlertDescription>
          As campanhas são planejadas com IA e as artes usam modelos prontos com foto real do produto. Tudo é enviado pausado para você revisar antes de ativar.
        </AlertDescription>
      </Alert>
    </div>
  );
}
