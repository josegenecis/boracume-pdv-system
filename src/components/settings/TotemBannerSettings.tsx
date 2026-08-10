import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Clock3, Eye, EyeOff, Film, ImageIcon, ImagePlus, Loader2, Monitor, Pencil, Plus, Save, Smartphone, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_TOTEM_THEME, type TotemBanner } from '@/types/totem';

type BannerForm = {
  title: string;
  description: string;
  media_url: string;
  media_type: TotemBanner['media_type'];
  orientation: TotemBanner['orientation'];
  active: boolean;
  display_order: number;
};

const EMPTY_FORM: BannerForm = {
  title: '',
  description: '',
  media_url: '',
  media_type: 'image',
  orientation: 'both',
  active: true,
  display_order: 0,
};

const ORIENTATION_LABEL: Record<TotemBanner['orientation'], string> = {
  both: 'Vertical e horizontal',
  portrait: 'Somente vertical',
  landscape: 'Somente horizontal',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message || fallback);
  return fallback;
};

export default function TotemBannerSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [banners, setBanners] = useState<TotemBanner[]>([]);
  const [form, setForm] = useState<BannerForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<TotemBanner | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [playback, setPlayback] = useState({
    idle_timeout_minutes: DEFAULT_TOTEM_THEME.idle_timeout_minutes,
    banner_interval_seconds: DEFAULT_TOTEM_THEME.banner_interval_seconds,
  });
  const [isSavingPlayback, setIsSavingPlayback] = useState(false);

  const imageCount = banners.filter((banner) => banner.media_type === 'image').length;
  const videoCount = banners.filter((banner) => banner.media_type === 'video').length;

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [bannerResult, settingResult] = await Promise.all([
      supabase
        .from('totem_banners')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('totem_settings')
        .select('idle_timeout_minutes,banner_interval_seconds')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const { data, error } = bannerResult;

    if (error) {
      toast({ title: 'Erro ao carregar banners', description: error.message, variant: 'destructive' });
    } else {
      setBanners(((data || []) as TotemBanner[]).map((banner) => ({
        ...banner,
        media_type: banner.media_type || 'image',
      })));
    }
    if (!settingResult.error && settingResult.data) {
      setPlayback({
        idle_timeout_minutes: Number(settingResult.data.idle_timeout_minutes || DEFAULT_TOTEM_THEME.idle_timeout_minutes),
        banner_interval_seconds: Number(settingResult.data.banner_interval_seconds || DEFAULT_TOTEM_THEME.banner_interval_seconds),
      });
    }
    setIsLoading(false);
  }, [toast, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, display_order: banners.length });
    setDialogOpen(true);
  };

  const openEdit = (banner: TotemBanner) => {
    setEditing(banner);
    setForm({
      title: banner.title || '',
      description: banner.description || '',
      media_url: banner.media_url,
      media_type: banner.media_type,
      orientation: banner.orientation,
      active: banner.active,
      display_order: banner.display_order,
    });
    setDialogOpen(true);
  };

  const upload = async (file: File) => {
    if (!user?.id) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem ou vídeo.', variant: 'destructive' });
      return;
    }
    const mediaType: TotemBanner['media_type'] = file.type.startsWith('video/') ? 'video' : 'image';
    const currentTypeCount = banners.filter((banner) => banner.media_type === mediaType && banner.id !== editing?.id).length;
    const typeLimit = mediaType === 'video' ? 5 : 15;
    if (currentTypeCount >= typeLimit) {
      toast({
        title: `Limite de ${mediaType === 'video' ? 'vídeos' : 'imagens'} atingido`,
        description: `O Totem aceita até ${typeLimit} ${mediaType === 'video' ? 'vídeos' : 'imagens'}. Exclua uma mídia para adicionar outra.`,
        variant: 'destructive',
      });
      return;
    }
    const maxBytes = mediaType === 'video' ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({ title: 'Arquivo muito grande', description: `Use ${mediaType === 'video' ? 'um vídeo de até 100 MB' : 'uma imagem de até 15 MB'}.`, variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${user.id}/${mediaType}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error } = await supabase.storage.from('totem-media').upload(path, file, { cacheControl: '86400', upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('totem-media').getPublicUrl(path);
      setForm((current) => ({ ...current, media_url: data.publicUrl, media_type: mediaType }));
      toast({ title: 'Mídia carregada', description: 'Confira a prévia e salve o banner.' });
    } catch (error: unknown) {
      toast({ title: 'Erro no upload', description: getErrorMessage(error, 'Não foi possível enviar o arquivo.'), variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const save = async () => {
    if (!user?.id || !form.media_url) {
      toast({ title: 'Adicione uma mídia', description: 'O banner precisa de uma imagem ou vídeo.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        media_url: form.media_url,
        media_type: form.media_type,
        orientation: form.orientation,
        active: form.active,
        display_order: Number(form.display_order || 0),
      };
      const query = editing
        ? supabase.from('totem_banners').update(payload).eq('id', editing.id)
        : supabase.from('totem_banners').insert(payload);
      const { error } = await query;
      if (error) throw error;

      toast({ title: editing ? 'Banner atualizado' : 'Banner criado', description: 'A tela de espera do Totem já pode usar esta campanha.' });
      setDialogOpen(false);
      await load();
    } catch (error: unknown) {
      toast({ title: 'Erro ao salvar banner', description: getErrorMessage(error, 'Não foi possível salvar.'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const savePlayback = async () => {
    if (!user?.id) return;
    const normalized = {
      idle_timeout_minutes: Math.min(60, Math.max(1, Number(playback.idle_timeout_minutes || 3))),
      banner_interval_seconds: Math.min(30, Math.max(4, Number(playback.banner_interval_seconds || 7))),
    };
    setIsSavingPlayback(true);
    try {
      const { error } = await supabase
        .from('totem_settings')
        .upsert({ user_id: user.id, ...normalized }, { onConflict: 'user_id' });
      if (error) throw error;
      setPlayback(normalized);
      toast({ title: 'Exibição automática salva', description: `Os anúncios iniciarão após ${normalized.idle_timeout_minutes} minuto(s) sem uso.` });
    } catch (error: unknown) {
      toast({ title: 'Erro ao salvar exibição', description: getErrorMessage(error, 'Não foi possível salvar.'), variant: 'destructive' });
    } finally {
      setIsSavingPlayback(false);
    }
  };

  const move = async (banner: TotemBanner, direction: -1 | 1) => {
    const index = banners.findIndex((item) => item.id === banner.id);
    const target = banners[index + direction];
    if (index < 0 || !target) return;
    const currentOrder = banner.display_order;
    const targetOrder = target.display_order;
    const { error } = await (supabase as any).rpc('reorder_totem_media', {
      p_first_id: banner.id,
      p_first_order: targetOrder,
      p_second_id: target.id,
      p_second_order: currentOrder,
    });
    if (error) {
      // Backward-compatible fallback if the atomic RPC has not reached the database yet.
      const [first, second] = await Promise.all([
        supabase.from('totem_banners').update({ display_order: targetOrder }).eq('id', banner.id),
        supabase.from('totem_banners').update({ display_order: currentOrder }).eq('id', target.id),
      ]);
      if (first.error || second.error) {
        toast({ title: 'Erro ao reordenar', description: first.error?.message || second.error?.message, variant: 'destructive' });
        return;
      }
    }
    await load();
  };

  const toggle = async (banner: TotemBanner) => {
    const { error } = await supabase.from('totem_banners').update({ active: !banner.active }).eq('id', banner.id);
    if (error) {
      toast({ title: 'Erro ao atualizar banner', description: error.message, variant: 'destructive' });
      return;
    }
    await load();
  };

  const remove = async (banner: TotemBanner) => {
    if (!window.confirm(`Excluir o banner “${banner.title || 'sem título'}”?`)) return;
    const { error } = await supabase.from('totem_banners').delete().eq('id', banner.id);
    if (error) {
      toast({ title: 'Erro ao excluir banner', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Banner excluído' });
    await load();
  };

  return (
    <div className="space-y-5">
      <Card className="border-[#dce8df]">
        <CardHeader className="border-b border-stone-100">
          <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-[#ef6c20]" />Exibição automática</CardTitle>
          <CardDescription>Defina quando os anúncios começam e por quanto tempo cada imagem permanece na tela. Os vídeos avançam quando terminam.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <Label htmlFor="totem-idle-timeout">Iniciar anúncios após</Label>
            <div className="relative mt-2">
              <Input id="totem-idle-timeout" type="number" min={1} max={60} value={playback.idle_timeout_minutes} onChange={(event) => setPlayback((current) => ({ ...current, idle_timeout_minutes: Number(event.target.value) }))} className="h-12 pr-20" />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">minutos</span>
            </div>
          </div>
          <div>
            <Label htmlFor="totem-image-duration">Duração de cada imagem</Label>
            <div className="relative mt-2">
              <Input id="totem-image-duration" type="number" min={4} max={30} value={playback.banner_interval_seconds} onChange={(event) => setPlayback((current) => ({ ...current, banner_interval_seconds: Number(event.target.value) }))} className="h-12 pr-24" />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">segundos</span>
            </div>
          </div>
          <Button type="button" onClick={() => void savePlayback()} disabled={isSavingPlayback} className="h-12 rounded-xl bg-[#073a2d] px-5 font-black text-white hover:bg-[#0a4b3a]">
            {isSavingPlayback ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar exibição
          </Button>
        </CardContent>
      </Card>

    <Card className="border-[#dce8df]">
      <CardHeader className="flex flex-col gap-4 border-b border-stone-100 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-[#ef6c20]" />Mídias de propaganda</CardTitle>
          <CardDescription className="mt-1">Sequência exclusiva da tela ociosa, com campanhas diferentes para totens verticais e horizontais.</CardDescription>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700"><Film className="mr-1.5 inline h-3.5 w-3.5" />{videoCount}/5 vídeos</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700"><ImageIcon className="mr-1.5 inline h-3.5 w-3.5" />{imageCount}/15 imagens</span>
          </div>
        </div>
        <Button type="button" onClick={openNew} disabled={videoCount >= 5 && imageCount >= 15} className="h-12 rounded-xl bg-[#ef6c20] font-black text-white hover:bg-[#da5e17]">
          <Plus className="mr-2 h-4 w-4" />Adicionar mídia
        </Button>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#ef6c20]" /></div>
        ) : banners.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50 p-8 text-center">
            <ImagePlus className="h-12 w-12 text-stone-300" />
            <div className="mt-4 text-xl font-black text-stone-800">Nenhuma propaganda cadastrada</div>
            <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-stone-500">Adicione imagens ou vídeos. Enquanto isso, o Totem usa produtos em destaque e a capa da loja.</p>
            <Button type="button" onClick={openNew} variant="outline" className="mt-5 h-11 rounded-xl font-bold">Adicionar primeira mídia</Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {banners.map((banner) => (
              <article key={banner.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${banner.active ? 'border-stone-200' : 'border-dashed border-stone-300 opacity-65'}`}>
                <div className="aspect-video bg-stone-100">
                  {banner.media_type === 'video' ? (
                    <video src={banner.media_url} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    <img src={banner.media_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-black text-stone-900">{banner.title || 'Banner sem título'}</h3>
                      <div className="mt-1 text-[11px] font-black uppercase tracking-wider text-[#ef6c20]">{banner.media_type === 'video' ? 'Vídeo' : 'Imagem'} · posição {banners.indexOf(banner) + 1}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-stone-500">
                        {banner.orientation === 'portrait' ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                        {ORIENTATION_LABEL[banner.orientation]}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${banner.active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{banner.active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={banners[0]?.id === banner.id} onClick={() => void move(banner, -1)} aria-label="Mover mídia para cima"><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="sm" disabled={banners[banners.length - 1]?.id === banner.id} onClick={() => void move(banner, 1)} aria-label="Mover mídia para baixo"><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void toggle(banner)} aria-label={banner.active ? 'Desativar banner' : 'Ativar banner'}>
                      {banner.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(banner)} aria-label="Editar banner"><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void remove(banner)} className="text-red-600 hover:bg-red-50 hover:text-red-700" aria-label="Excluir banner"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar mídia do Totem' : 'Nova mídia do Totem'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label htmlFor="totem-banner-title">Título da propaganda</Label>
                <Input id="totem-banner-title" value={form.title} maxLength={80} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-2 h-12" />
              </div>
              <div>
                <Label htmlFor="totem-banner-description">Mensagem</Label>
                <Textarea id="totem-banner-description" value={form.description} maxLength={220} rows={4} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2" />
              </div>
              <div>
                <Label>Orientação da tela</Label>
                <Select value={form.orientation} onValueChange={(value: TotemBanner['orientation']) => setForm((current) => ({ ...current, orientation: value }))}>
                  <SelectTrigger className="mt-2 h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Vertical e horizontal</SelectItem>
                    <SelectItem value="portrait">Somente vertical</SelectItem>
                    <SelectItem value="landscape">Somente horizontal</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs font-medium leading-5 text-stone-500">Para melhor qualidade: vertical 1080×1920; horizontal 1920×1080.</p>
              </div>
              <div>
                <Label htmlFor="totem-banner-order">Ordem de exibição</Label>
                <Input id="totem-banner-order" type="number" min={0} value={form.display_order} onChange={(event) => setForm((current) => ({ ...current, display_order: Number(event.target.value) }))} className="mt-2 h-12" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-stone-200 p-4">
                <div><div className="font-black text-stone-800">Banner ativo</div><div className="text-xs font-medium text-stone-500">Exibir na próxima rotação</div></div>
                <Switch checked={form.active} onCheckedChange={(checked) => setForm((current) => ({ ...current, active: checked }))} />
              </div>
            </div>
            <div>
              <Label>Mídia da campanha</Label>
              <div className="mt-2 overflow-hidden rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50">
                {form.media_url ? (
                  <div className="aspect-video">
                    {form.media_type === 'video' ? <video src={form.media_url} controls className="h-full w-full object-cover" /> : <img src={form.media_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                ) : (
                  <div className="flex aspect-video flex-col items-center justify-center p-6 text-center text-stone-400"><Upload className="h-10 w-10" /><div className="mt-3 text-sm font-bold">Imagem ou vídeo</div></div>
                )}
                <div className="border-t border-stone-200 bg-white p-3">
                  <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-stone-200 bg-white text-sm font-black text-stone-700 hover:bg-stone-50">
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {isUploading ? 'Enviando...' : 'Selecionar imagem ou vídeo'}
                    <input type="file" accept="image/*,video/*" className="sr-only" disabled={isUploading} onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file);
                      event.target.value = '';
                    }} />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => void save()} disabled={isSaving || isUploading} className="bg-[#ef6c20] font-black text-white hover:bg-[#da5e17]">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar mídia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </div>
  );
}
