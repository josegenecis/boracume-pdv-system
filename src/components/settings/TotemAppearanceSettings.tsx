import { useEffect, useState } from 'react';
import { Loader2, Palette, RotateCcw, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_TOTEM_THEME, type TotemThemeSettings } from '@/types/totem';

type TotemColorKey =
  | 'primary_color'
  | 'secondary_color'
  | 'accent_color'
  | 'background_color'
  | 'surface_color'
  | 'text_color'
  | 'price_color'
  | 'button_text_color'
  | 'idle_overlay_color';

const COLOR_FIELDS: Array<{ key: TotemColorKey; label: string; description: string }> = [
  { key: 'primary_color', label: 'Botões principais', description: 'Adicionar, avançar e iniciar pedido' },
  { key: 'secondary_color', label: 'Cor institucional', description: 'Categorias ativas, ícones e destaques escuros' },
  { key: 'accent_color', label: 'Cor de apoio', description: 'Selos, estados positivos e detalhes' },
  { key: 'background_color', label: 'Fundo do cardápio', description: 'Área geral de produtos e categorias' },
  { key: 'surface_color', label: 'Fundo dos cartões', description: 'Produtos, cabeçalho e barra do pedido' },
  { key: 'text_color', label: 'Textos principais', description: 'Títulos, nomes de produtos e descrições' },
  { key: 'price_color', label: 'Cor dos preços', description: 'Valores dos produtos, adicionais e total do pedido' },
  { key: 'button_text_color', label: 'Texto dos botões', description: 'Contraste sobre os botões principais' },
  { key: 'idle_overlay_color', label: 'Proteção dos banners', description: 'Degradê que garante a leitura sobre as imagens' },
];

const normalizeHex = (value: string, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(String(value || '').trim()) ? value.toUpperCase() : fallback;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Não foi possível salvar as configurações.';

export default function TotemAppearanceSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<TotemThemeSettings>(DEFAULT_TOTEM_THEME);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const { data } = await supabase
        .from('totem_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cancelled) {
        setForm({ ...DEFAULT_TOTEM_THEME, ...(data || {}) });
        setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const update = <K extends keyof TotemThemeSettings>(key: K, value: TotemThemeSettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateColor = (key: TotemColorKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const normalized = {
        ...form,
        primary_color: normalizeHex(form.primary_color, DEFAULT_TOTEM_THEME.primary_color),
        secondary_color: normalizeHex(form.secondary_color, DEFAULT_TOTEM_THEME.secondary_color),
        accent_color: normalizeHex(form.accent_color, DEFAULT_TOTEM_THEME.accent_color),
        background_color: normalizeHex(form.background_color, DEFAULT_TOTEM_THEME.background_color),
        surface_color: normalizeHex(form.surface_color, DEFAULT_TOTEM_THEME.surface_color),
        text_color: normalizeHex(form.text_color, DEFAULT_TOTEM_THEME.text_color),
        price_color: normalizeHex(form.price_color, DEFAULT_TOTEM_THEME.price_color),
        button_text_color: normalizeHex(form.button_text_color, DEFAULT_TOTEM_THEME.button_text_color),
        idle_overlay_color: normalizeHex(form.idle_overlay_color, DEFAULT_TOTEM_THEME.idle_overlay_color),
        cta_text: form.cta_text.trim() || DEFAULT_TOTEM_THEME.cta_text,
        banner_interval_seconds: Math.min(30, Math.max(4, Number(form.banner_interval_seconds || 7))),
      };

      const { error } = await supabase
        .from('totem_settings')
        .upsert({ user_id: user.id, ...normalized }, { onConflict: 'user_id' });
      if (error) throw error;

      setForm(normalized);
      toast({ title: 'Aparência salva', description: 'As novas cores já estão disponíveis no Totem.' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar aparência',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#ef6c20]" /></div>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="border-[#dce8df]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-[#ef6c20]" />Identidade visual exclusiva</CardTitle>
          <CardDescription>Estas escolhas afetam somente o Totem. O cardápio digital do celular permanece como está.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {COLOR_FIELDS.map((field) => {
              const value = String(form[field.key]);
              return (
                <div key={field.key} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <Label className="font-black text-stone-800">{field.label}</Label>
                  <p className="mt-1 min-h-10 text-xs font-medium leading-5 text-stone-500">{field.description}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="color"
                      value={value}
                      onChange={(event) => updateColor(field.key, event.target.value)}
                      className="h-12 w-14 cursor-pointer rounded-xl border border-stone-200 bg-white p-1"
                      aria-label={field.label}
                    />
                    <Input
                      value={value}
                      maxLength={7}
                      onChange={(event) => updateColor(field.key, event.target.value)}
                      className="h-12 font-mono font-bold uppercase"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div>
              <Label htmlFor="totem-cta">Texto do botão inicial</Label>
              <Input id="totem-cta" value={form.cta_text} maxLength={40} onChange={(event) => update('cta_text', event.target.value)} className="mt-2 h-12" />
            </div>
            <div>
              <Label htmlFor="totem-interval">Trocar banner a cada</Label>
              <div className="relative mt-2">
                <Input
                  id="totem-interval"
                  type="number"
                  min={4}
                  max={30}
                  value={form.banner_interval_seconds}
                  onChange={(event) => update('banner_interval_seconds', Number(event.target.value))}
                  className="h-12 pr-20"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">segundos</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" className="h-12 rounded-xl font-bold" onClick={() => setForm(DEFAULT_TOTEM_THEME)}>
              <RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão
            </Button>
            <Button type="button" className="h-12 rounded-xl bg-[#ef6c20] px-6 font-black text-white hover:bg-[#da5e17]" onClick={save} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar aparência
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-[#dce8df]">
        <CardHeader className="bg-stone-950 text-white">
          <CardTitle>Prévia rápida</CardTitle>
          <CardDescription className="text-white/60">Uma amostra da combinação escolhida.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="min-h-[520px] p-6" style={{ backgroundColor: form.background_color, color: form.text_color }}>
            <div className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: form.surface_color }}>
              <div className="text-sm font-black uppercase tracking-wider" style={{ color: form.secondary_color }}>Mais pedidos</div>
              <div className="mt-4 aspect-[4/3] rounded-xl bg-gradient-to-br from-orange-100 via-amber-50 to-emerald-100" />
              <div className="mt-4 text-xl font-black">Produto em destaque</div>
              <div className="mt-1 text-sm opacity-65">Descrição curta e fácil de ler no autoatendimento.</div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-2xl font-black" style={{ color: form.price_color }}>R$ 24,90</div>
                <button type="button" className="h-12 rounded-xl px-5 font-black" style={{ backgroundColor: form.primary_color, color: form.button_text_color }}>Adicionar</button>
              </div>
            </div>
            <div className="mt-5 rounded-2xl p-4 text-center font-black" style={{ backgroundColor: form.secondary_color, color: form.button_text_color }}>
              Categoria selecionada
            </div>
            <div className="mt-5 rounded-2xl p-5" style={{ backgroundColor: form.surface_color }}>
              <div className="text-sm font-bold opacity-60">Total do pedido</div>
              <div className="mt-1 text-3xl font-black" style={{ color: form.price_color }}>R$ 24,90</div>
              <button type="button" className="mt-4 h-14 w-full rounded-xl font-black" style={{ backgroundColor: form.primary_color, color: form.button_text_color }}>
                {form.cta_text || DEFAULT_TOTEM_THEME.cta_text}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
