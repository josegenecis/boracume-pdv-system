import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Facebook, MapPin, Megaphone, RefreshCw, Send, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function PopMarketingAI() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [connection, setConnection] = useState<MetaConnection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [selectedCopyIndex, setSelectedCopyIndex] = useState(0);
  const [loading, setLoading] = useState(false);
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
  });

  const selectedProduct = useMemo(() => products.find((item) => item.id === form.productId) || null, [form.productId, products]);
  const selectedCampaignProduct = selectedCampaign?.ai_strategy?.product || null;
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
      toast({ title: 'Ativos atualizados', description: 'Contas, páginas, Instagram e WhatsApp foram sincronizados.' });
    } catch (error: any) {
      toast({ title: 'Erro ao sincronizar', description: error?.message || 'Tente reconectar a Meta.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
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
      toast({ title: 'Erro ao gerar campanha', description: error?.message || 'Não foi possível gerar o plano.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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
    setCreatives(Array.isArray(data) && data.length > 0 ? data : snapshotCreatives);
  };

  const publishPaused = async () => {
    if (!selectedCampaign?.id) return;
    setLoading(true);
    try {
      await callPopMarketingAI({ action: 'publish_paused', campaignId: selectedCampaign.id, copyIndex: selectedCopyIndex });
      toast({ title: 'Campanha enviada pausada', description: 'Ela foi criada na Meta como PAUSED para revisão final.' });
      await loadCampaigns();
    } catch (error: any) {
      toast({ title: 'Não foi possível publicar', description: error?.message || 'Confira permissões, página e conta de anúncio.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const restaurantName = (profile as any)?.restaurant_name || 'PopSystem';
  const selectedCopy = selectedCampaign?.ai_strategy?.copies?.[selectedCopyIndex] || selectedCampaign?.ai_strategy?.copies?.[0] || null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-[#062f23] text-white shadow-xl">
        <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.28em] text-[#d9ff99]">
              <Sparkles className="h-4 w-4" /> PopMarketing AI
            </div>
            <h2 className="text-3xl font-black">Tráfego pago com IA para restaurantes</h2>
            <p className="mt-2 max-w-3xl text-white/78">
              Conecte Meta Ads, gere estratégia, copys e criativos, revise tudo e publique campanhas pausadas com segurança.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={connectMeta} disabled={loading} className="bg-[#ff5a00] text-white hover:bg-[#e75000]">
              <Facebook className="mr-2 h-4 w-4" /> Conectar Meta Ads
            </Button>
            <Button onClick={syncAssets} disabled={loading || !connection} variant="secondary">
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar ativos
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-[#ff5a00]" /> Criar campanha com IA</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select value={form.objective} onValueChange={(v) => setForm((p) => ({ ...p, objective: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vender_mais">Vender mais</SelectItem>
                  <SelectItem value="divulgar_promocao">Divulgar promoção</SelectItem>
                  <SelectItem value="aumentar_pedidos">Aumentar pedidos</SelectItem>
                  <SelectItem value="recuperar_clientes">Recuperar clientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Destino do botão</Label>
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
              <Label>Produto em foco</Label>
              <Select value={form.productId} onValueChange={(v) => setForm((p) => ({ ...p, productId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">IA escolhe / categoria</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name} - {money(product.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Produto/categoria livre</Label>
              <Input value={form.productFocus} onChange={(e) => setForm((p) => ({ ...p, productFocus: e.target.value }))} placeholder="Ex.: açaí 500ml, pizzas, combos" />
            </div>
            <div className="space-y-2">
              <Label>Verba diária</Label>
              <Input type="number" min={5} value={form.dailyBudget} onChange={(e) => setForm((p) => ({ ...p, dailyBudget: Number(e.target.value || 0) }))} />
            </div>
            <div className="space-y-2">
              <Label>Raio do anúncio em km</Label>
              <Input type="number" min={1} value={form.targetRadiusKm} onChange={(e) => setForm((p) => ({ ...p, targetRadiusKm: Number(e.target.value || 0) }))} />
              <p className="text-xs text-muted-foreground">A Meta usa esse raio a partir do endereço do restaurante. Se não houver coordenada, o sistema usa a cidade/BR como fallback.</p>
            </div>
            <div className="space-y-2">
              <Label>Cidade alvo</Label>
              <Input value={form.targetCity} onChange={(e) => setForm((p) => ({ ...p, targetCity: e.target.value }))} placeholder="Ex.: Fortaleza" />
            </div>
            <div className="space-y-2">
              <Label>Data final</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações para IA</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Ex.: destacar entrega rápida, promoção só hoje, evitar prometer tempo exato..." />
            </div>
            <div className="md:col-span-2">
              <Button onClick={generatePlan} disabled={loading} className="w-full bg-[#ff5a00] text-white hover:bg-[#e75000]">
                <Sparkles className="mr-2 h-4 w-4" /> Gerar campanha para revisão
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Conexão Meta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <Badge className={connection?.status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-700'}>{connection?.status || 'desconectado'}</Badge>
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
                  <TabsTrigger value="copy">Copys</TabsTrigger>
                  <TabsTrigger value="creative">Criativos</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl bg-muted p-4"><div className="text-xs text-muted-foreground">Status</div><div className="font-black">{statusLabel[selectedCampaign.status] || selectedCampaign.status}</div></div>
                    <div className="rounded-xl bg-muted p-4"><div className="text-xs text-muted-foreground">Verba diária</div><div className="font-black">{money(selectedCampaign.daily_budget)}</div></div>
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
                        : `Sem coordenada automática no momento. Ao publicar, o fallback usa segmentação ampla no Brasil até o endereço do restaurante ser geocodificado.`}
                    </p>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-xl bg-[#062f23] p-4 text-xs text-white">{JSON.stringify(selectedCampaign.ai_strategy || {}, null, 2)}</pre>
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
                  {creatives.map((creative) => {
                    const productName = selectedCampaignProduct?.name || selectedCampaign.product_focus || selectedProduct?.name || 'Oferta especial';
                    const productPrice = selectedCampaignProduct?.price ? money(selectedCampaignProduct.price) : selectedProduct ? money(selectedProduct.price) : 'Peça agora';
                    const imageUrl = normalizeImageUrlForDisplay(creative.image_url || selectedCampaignProduct?.image_url || selectedProduct?.image_url);
                    const logoUrl = normalizeImageUrlForDisplay(creative.logo_url || selectedCampaign?.ai_strategy?.restaurant?.logo_url || (profile as any)?.logo_url);
                    const isTall = creative.format.includes('1080x1920');
                    return (
                      <div key={creative.id || creative.format} className="rounded-xl border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <strong>{creative.format}</strong>
                          <Badge variant="outline">{creative.type}</Badge>
                        </div>
                        <div className={`relative mx-auto overflow-hidden rounded-lg bg-gradient-to-br from-[#003223] via-[#065f46] to-[#ff5a00] text-white shadow-inner ${isTall ? 'aspect-[9/16] max-h-[520px]' : creative.format.includes('1200x628') ? 'aspect-[1200/628]' : 'aspect-square'}`}>
                          <div className="absolute inset-0 opacity-15">
                            <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white" />
                            <div className="absolute -bottom-20 left-8 h-56 w-56 rounded-full bg-white" />
                          </div>
                          <div className={`relative z-10 flex h-full gap-4 p-8 ${isTall ? 'flex-col justify-between' : 'items-center justify-between'}`}>
                            <div className={isTall ? 'space-y-5' : 'max-w-[54%] space-y-4'}>
                              {logoUrl ? (
                                <img src={logoUrl} alt={restaurantName} className="h-12 max-w-[180px] object-contain object-left" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <div className="text-lg font-black">{restaurantName}</div>
                              )}
                              <div className="text-sm font-bold uppercase tracking-[0.16em] text-[#d9ff99]">{selectedCopy?.headline || creative.headline || `${productName} em oferta`}</div>
                              <div className={isTall ? 'text-4xl font-black leading-tight' : 'text-3xl font-black leading-tight'}>{productName}</div>
                              <div className={isTall ? 'text-5xl font-black' : 'text-4xl font-black'}>{productPrice}</div>
                              <div className="inline-flex rounded-2xl bg-[#ff5a00] px-5 py-3 text-sm font-black uppercase shadow-lg">{creative.cta === 'WHATSAPP_MESSAGE' ? 'Chame no WhatsApp' : 'Clique e peça'}</div>
                            </div>
                            <div className={`relative flex items-center justify-center overflow-hidden rounded-3xl bg-white/95 shadow-xl ${isTall ? 'h-[42%] w-full' : 'h-[76%] w-[38%]'}`}>
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-orange-50 p-4 text-center text-[#003223]">
                                <Sparkles className="mb-3 h-10 w-10 text-[#ff5a00]" />
                                <span className="text-lg font-black">{productName}</span>
                                <span className="mt-2 text-xs font-semibold text-muted-foreground">Imagem do produto</span>
                              </div>
                              {imageUrl ? (
                                <img src={imageUrl} alt={productName} className="relative z-10 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                              ) : null}
                            </div>
                          </div>
                        </div>
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
        <AlertTitle>MVP entregue com trava de segurança</AlertTitle>
        <AlertDescription>
          Campanhas são planejadas por IA e enviadas à Meta em modo pausado. Otimização automática, Reels dinâmico e campanhas por clima/estoque entram na próxima etapa.
        </AlertDescription>
      </Alert>
    </div>
  );
}
