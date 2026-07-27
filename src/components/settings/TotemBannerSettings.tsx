import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, ImagePlus, Loader2, Monitor, Pencil, Plus, Smartphone, Trash2, Upload } from 'lucide-react';
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
import { isVideoAsset } from '@/utils/videoAutoplay';
import type { TotemBanner } from '@/types/totem';

type BannerForm = {
  title: string;
  description: string;
  media_url: string;
  orientation: TotemBanner['orientation'];
  active: boolean;
  display_order: number;
};

const EMPTY_FORM: BannerForm = {
  title: '',
  description: '',
  media_url: '',
  orientation: 'both',
  active: true,
  display_order: 0,
};

const ORIENTATION_LABEL: Record<TotemBanner['orientation'], string> = {
  both: 'Vertical e horizontal',
  portrait: 'Somente vertical',
  landscape: 'Somente horizontal',
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

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

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('totem_banners')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao carregar banners', description: error.message, variant: 'destructive' });
    } else {
      setBanners((data || []) as TotemBanner[]);
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
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Use um arquivo de até 20 MB.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${user.id}/totem/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error } = await supabase.storage.from('promotional-banners').upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('promotional-banners').getPublicUrl(path);
      setForm((current) => ({ ...current, media_url: data.publicUrl }));
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
    <Card className="border-[#dce8df]">
      <CardHeader className="flex flex-col gap-4 border-b border-stone-100 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-[#ef6c20]" />Banners exclusivos do Totem</CardTitle>
          <CardDescription className="mt-1">Não aparecem no cardápio digital. Você pode criar campanhas diferentes para telas em pé e deitadas.</CardDescription>
        </div>
        <Button type="button" onClick={openNew} className="h-12 rounded-xl bg-[#ef6c20] font-black text-white hover:bg-[#da5e17]">
          <Plus className="mr-2 h-4 w-4" />Novo banner
        </Button>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#ef6c20]" /></div>
        ) : banners.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50 p-8 text-center">
            <ImagePlus className="h-12 w-12 text-stone-300" />
            <div className="mt-4 text-xl font-black text-stone-800">Nenhum banner exclusivo ainda</div>
            <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-stone-500">Até você criar o primeiro, o Totem usa produtos em destaque e a capa da loja como segurança.</p>
            <Button type="button" onClick={openNew} variant="outline" className="mt-5 h-11 rounded-xl font-bold">Criar primeiro banner</Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {banners.map((banner) => (
              <article key={banner.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${banner.active ? 'border-stone-200' : 'border-dashed border-stone-300 opacity-65'}`}>
                <div className="aspect-video bg-stone-100">
                  {isVideoAsset(banner.media_url) ? (
                    <video src={banner.media_url} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    <img src={banner.media_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-black text-stone-900">{banner.title || 'Banner sem título'}</h3>
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-stone-500">
                        {banner.orientation === 'portrait' ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                        {ORIENTATION_LABEL[banner.orientation]}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${banner.active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{banner.active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
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
            <DialogTitle>{editing ? 'Editar banner do Totem' : 'Novo banner do Totem'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label htmlFor="totem-banner-title">Título da promoção</Label>
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
                    {isVideoAsset(form.media_url) ? <video src={form.media_url} controls className="h-full w-full object-cover" /> : <img src={form.media_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                ) : (
                  <div className="flex aspect-video flex-col items-center justify-center p-6 text-center text-stone-400"><Upload className="h-10 w-10" /><div className="mt-3 text-sm font-bold">Imagem ou vídeo</div></div>
                )}
                <div className="border-t border-stone-200 bg-white p-3">
                  <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-stone-200 bg-white text-sm font-black text-stone-700 hover:bg-stone-50">
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {isUploading ? 'Enviando...' : 'Selecionar mídia'}
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
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar banner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
