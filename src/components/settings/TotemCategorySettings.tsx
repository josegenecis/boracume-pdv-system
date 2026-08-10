import { useEffect, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type TotemCategory = {
  id: string;
  name: string;
  description: string | null;
  totem_image_url: string | null;
};

const BUCKET = 'totem-category-images';

export default function TotemCategorySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<TotemCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const loadCategories = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase.from('product_categories') as any)
        .select('id,name,description,totem_image_url')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      setCategories((data || []) as TotemCategory[]);
    } catch (error) {
      toast({
        title: 'Não foi possível carregar as categorias',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, [user?.id]);

  const uploadImage = async (category: TotemCategory, file?: File) => {
    if (!user?.id || !file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Escolha uma imagem válida', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'O limite é 10 MB.', variant: 'destructive' });
      return;
    }

    try {
      setUploadingId(category.id);
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${user.id}/${category.id}/category-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const imageUrl = data.publicUrl;
      const { error: updateError } = await (supabase.from('product_categories') as any)
        .update({ totem_image_url: imageUrl, updated_at: new Date().toISOString() })
        .eq('id', category.id)
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, totem_image_url: imageUrl } : item));
      toast({ title: 'Imagem da categoria atualizada' });
    } catch (error) {
      toast({
        title: 'Falha ao enviar imagem',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingId(null);
    }
  };

  const removeImage = async (category: TotemCategory) => {
    if (!user?.id) return;
    try {
      setUploadingId(category.id);
      const { error } = await (supabase.from('product_categories') as any)
        .update({ totem_image_url: null, updated_at: new Date().toISOString() })
        .eq('id', category.id)
        .eq('user_id', user.id);
      if (error) throw error;
      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, totem_image_url: null } : item));
      toast({ title: 'Imagem removida', description: 'O Totem usará a imagem de um produto como capa automática.' });
    } catch (error) {
      toast({
        title: 'Não foi possível remover',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <Card className="border-[#dce8df]">
      <CardHeader className="border-b bg-gradient-to-r from-[#f7faf7] to-white">
        <CardTitle className="flex items-center gap-2 text-2xl text-[#164b39]"><ImagePlus className="h-6 w-6 text-[#67a83f]" />Categorias visuais</CardTitle>
        <CardDescription>Adicione uma capa para cada categoria da barra lateral. Sem capa, o Totem usa automaticamente a primeira imagem disponível naquela categoria.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-sm font-semibold text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando categorias...</div>
        ) : categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm font-semibold text-muted-foreground">Cadastre categorias no cardápio para personalizá-las aqui.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => {
              const busy = uploadingId === category.id;
              return (
                <div key={category.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <div className="aspect-[16/9] bg-gradient-to-br from-stone-100 to-emerald-50">
                    {category.totem_image_url ? <img src={category.totem_image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm font-bold text-stone-400">Capa automática</div>}
                  </div>
                  <div className="space-y-3 p-4">
                    <div><div className="font-black text-[#164b39]">{category.name}</div>{category.description ? <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{category.description}</div> : null}</div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" className="flex-1 rounded-xl font-bold" disabled={busy}>
                        <label className="cursor-pointer">
                          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          {category.totem_image_url ? 'Trocar' : 'Enviar capa'}
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={busy} onChange={(event) => { void uploadImage(category, event.target.files?.[0]); event.currentTarget.value = ''; }} />
                        </label>
                      </Button>
                      {category.totem_image_url ? <Button type="button" variant="ghost" size="icon" className="rounded-xl text-red-600" disabled={busy} onClick={() => void removeImage(category)} aria-label={`Remover imagem de ${category.name}`}><Trash2 className="h-4 w-4" /></Button> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
