
import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ImageIcon, Upload, X, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { compressImageFileToMaxBytes } from '@/utils/imageCompression';
import { prepareBannerVideoFile } from '@/utils/videoCompression';

interface Banner {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  link_url?: string;
  product_id?: string | null;
  start_date?: string;
  end_date?: string;
  active: boolean;
  display_order: number;
  banner_type?: 'wide' | 'tile';
}

const isVideoAsset = (value?: string) => /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(value || '').trim());

const BannerManager = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [assetKind, setAssetKind] = useState<'image' | 'video'>('image');
  const [assetDurationSeconds, setAssetDurationSeconds] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link_url: '',
    product_id: '__none__',
    display_order: 0,
    active: true,
    banner_type: 'wide' as 'wide' | 'tile'
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const confirm = useConfirmDialog();

  useEffect(() => {
    if (user) {
      fetchBanners();
      fetchProducts();
    }
  }, [user]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await (supabase.from('products') as any)
        .select('id,name,price')
        .eq('user_id', user?.id)
        .eq('is_available', true)
        .eq('show_in_delivery', true)
        .order('name', { ascending: true });
      if (error) throw error;
      setProducts((data || []) as any);
    } catch {
      setProducts([]);
    }
  };

  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('promotional_banners')
        .select('*')
        .eq('user_id', user?.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setBanners(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar banners:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os banners.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isTileBanner = formData.banner_type === 'tile';
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        toast({
          title: "Erro",
          description: "Selecione uma imagem ou vídeo válido.",
          variant: "destructive"
        });
        return;
      }

      if (isVideo && !isTileBanner) {
        toast({
          title: "Erro",
          description: "Vídeos são permitidos apenas no banner vertical.",
          variant: "destructive"
        });
        return;
      }

      const prepareFile = async () => {
        try {
          if (isImage) {
            if (file.size > 12 * 1024 * 1024) {
              throw new Error('A imagem está muito grande. Use um arquivo de até 12MB.');
            }
            const processedImage = file.size > 2 * 1024 * 1024
              ? await compressImageFileToMaxBytes(file, { maxBytes: 2 * 1024 * 1024, maxDimension: isTileBanner ? 1080 : 1600 })
              : file;

            setAssetKind('image');
            setAssetDurationSeconds(null);
            setImageFile(processedImage);
            const reader = new FileReader();
            reader.onload = (event) => {
              setImagePreview(event.target?.result as string);
            };
            reader.readAsDataURL(processedImage);
            return;
          }

          const processedVideo = await prepareBannerVideoFile(file, {
            maxBytes: 2 * 1024 * 1024,
            maxDurationSeconds: 20,
            maxSourceBytes: 40 * 1024 * 1024
          });

          setAssetKind('video');
          setAssetDurationSeconds(processedVideo.durationSeconds);
          setImageFile(processedVideo.file);
          setImagePreview(URL.createObjectURL(processedVideo.file));
          toast({
            title: processedVideo.compressed ? 'Vídeo compactado' : 'Vídeo pronto',
            description: processedVideo.compressed
              ? 'O vídeo foi compactado automaticamente para caber no banner vertical.'
              : 'Vídeo validado com sucesso.',
          });
        } catch (error: any) {
          toast({
            title: 'Erro no arquivo',
            description: error?.message || 'Não foi possível processar a mídia selecionada.',
            variant: 'destructive'
          });
        }
      };

      void prepareFile();
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('promotional-banners')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('promotional-banners')
        .getPublicUrl(fileName);
      
      return urlData.publicUrl;
    } catch (error: any) {
      const msg = String(error?.message || error || '');
      const hint =
        msg.toLowerCase().includes('bucket') || msg.toLowerCase().includes('not found')
          ? 'Bucket promotional-banners não encontrado. Rode o SQL do Marketing no Supabase.'
          : msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('permission')
            ? 'Sem permissão para upload. Confira as policies do bucket promotional-banners no SQL do Marketing.'
            : '';
      console.error('Erro ao fazer upload da imagem:', error);
      toast({
        title: "Erro no upload",
        description: hint || error.message || "Não foi possível fazer upload da imagem.",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !formData.title.trim()) return;

    try {
      setIsLoading(true);
      
      let imageUrl = editingBanner?.image_url || '';
      
      if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          return;
        }
      }
      
      if (editingBanner) {
        const { error } = await supabase
          .from('promotional_banners')
          .update({
            title: formData.title,
            description: formData.description || null,
            image_url: imageUrl || null,
            link_url: formData.link_url || null,
            product_id: formData.product_id === '__none__' ? null : formData.product_id,
            start_date: null,
            end_date: null,
            display_order: formData.display_order,
            active: formData.active,
            banner_type: formData.banner_type
          })
          .eq('id', editingBanner.id);
        
        if (error) throw error;
        
        toast({
          title: 'Banner atualizado',
          description: 'O banner foi atualizado com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('promotional_banners')
          .insert({
            user_id: user.id,
            title: formData.title,
            description: formData.description || null,
            image_url: imageUrl || null,
            link_url: formData.link_url || null,
            product_id: formData.product_id === '__none__' ? null : formData.product_id,
            start_date: null,
            end_date: null,
            display_order: formData.display_order,
            active: formData.active,
            banner_type: formData.banner_type
          });
        
        if (error) throw error;
        
        toast({
          title: 'Banner criado',
          description: 'O novo banner foi criado com sucesso.',
        });
      }
      
      resetForm();
      setIsDialogOpen(false);
      fetchBanners();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar banner',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (banner: Banner) => {
    const nextKind = isVideoAsset(banner.image_url) ? 'video' : 'image';
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      description: banner.description || '',
      link_url: banner.link_url || '',
      product_id: banner.product_id ? String(banner.product_id) : '__none__',
      display_order: banner.display_order,
      active: banner.active,
      banner_type: (banner.banner_type || 'wide') as any
    });
    setAssetKind(nextKind);
    setAssetDurationSeconds(null);
    setImagePreview(banner.image_url || '');
    setIsDialogOpen(true);
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('promotional_banners')
        .update({ active: !banner.active })
        .eq('id', banner.id);
      if (error) throw error;
      toast({
        title: banner.active ? 'Banner desativado' : 'Banner ativado',
        description: banner.active ? 'O banner foi ocultado.' : 'O banner voltou a ser exibido.',
      });
      fetchBanners();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar banner',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (bannerId: string) => {
    const ok = await confirm({
      title: 'Excluir banner',
      description: 'Tem certeza que deseja excluir este banner?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('promotional_banners')
        .delete()
        .eq('id', bannerId);
      
      if (error) throw error;
      
      toast({
        title: 'Banner excluído',
        description: 'O banner foi excluído com sucesso.',
      });
      
      fetchBanners();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir banner',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      link_url: '',
      product_id: '__none__',
      display_order: 0,
      active: true,
      banner_type: 'wide'
    });
    setEditingBanner(null);
    setImageFile(null);
    setImagePreview('');
    setAssetKind('image');
    setAssetDurationSeconds(null);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
    setAssetKind('image');
    setAssetDurationSeconds(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Banners Promocionais
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Banner
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingBanner ? 'Editar Banner' : 'Novo Banner'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Tipo de banner</Label>
                      <Select value={formData.banner_type} onValueChange={(v: any) => {
                        setFormData(prev => ({ ...prev, banner_type: v }));
                        if (v !== 'tile' && assetKind === 'video') {
                          removeImage();
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wide">Horizontal (menor)</SelectItem>
                          <SelectItem value="tile">10x15 (vertical)</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-muted-foreground mt-1">
                        Horizontal recomendado: 800x260 • 10x15 recomendado: 600x900
                      </div>
                      {formData.banner_type === 'tile' ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          O banner vertical aceita imagem ou vídeo. Vídeos ficam limitados a 20 segundos e 2MB após processamento.
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <Label>Vincular a um produto (opcional)</Label>
                      <Select value={formData.product_id} onValueChange={(v) => setFormData(prev => ({ ...prev, product_id: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhum produto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum</SelectItem>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} • R$ {Number(p.price || 0).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-muted-foreground mt-1">
                        Se vincular um produto, o banner abre a tela do produto no cardápio.
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="title">Título *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Título do banner"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Descrição do banner"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="link_url">Link (opcional)</Label>
                      <Input
                        id="link_url"
                        value={formData.link_url}
                        onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label>Status do banner</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Controle manual para exibir ou ocultar este banner.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={formData.active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
                      >
                        {formData.active ? 'Ativo' : 'Inativo'}
                      </Button>
                    </div>
                    <div>
                      <Label htmlFor="display_order">Ordem</Label>
                      <Input
                        id="display_order"
                        type="number"
                        value={formData.display_order}
                        onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{formData.banner_type === 'tile' ? 'Mídia do Banner' : 'Imagem do Banner'}</Label>
                    <div className="mt-1 border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center h-[250px] bg-muted/50 relative">
                      {imagePreview ? (
                        <div className="relative w-full h-full">
                          {assetKind === 'video' ? (
                            <video
                              src={imagePreview}
                              className="w-full h-full object-cover rounded"
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          ) : (
                            <img 
                              src={imagePreview} 
                              alt="Preview" 
                              className="w-full h-full object-cover rounded"
                            />
                          )}
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={removeImage}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          {assetKind === 'video' ? (
                            <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
                              Vídeo{assetDurationSeconds ? ` • ${assetDurationSeconds.toFixed(1)}s` : ''}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                          <div className="text-sm text-center text-muted-foreground mb-4">
                            {formData.banner_type === 'tile'
                              ? 'Selecione uma imagem ou vídeo para o banner vertical'
                              : 'Selecione uma imagem para o banner'}
                          </div>
                          <Input
                            type="file"
                            accept={formData.banner_type === 'tile' ? 'image/*,video/*' : 'image/*'}
                            onChange={handleImageChange}
                            className="hidden"
                            id="banner-upload"
                            disabled={uploading}
                            ref={fileInputRef}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {uploading ? 'Enviando...' : formData.banner_type === 'tile' ? 'Selecionar Mídia' : 'Selecionar Imagem'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={isLoading || uploading || !formData.title.trim()}
                  >
                    {isLoading ? 'Salvando...' : (editingBanner ? 'Atualizar' : 'Criar')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {banners.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum banner cadastrado ainda.</p>
            <p className="text-sm">Crie banners para promover ofertas especiais.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imagem</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.map((banner) => (
                <TableRow key={banner.id}>
                  <TableCell>
                    {banner.image_url ? (
                      isVideoAsset(banner.image_url) ? (
                        <video
                          src={banner.image_url}
                          className="w-16 h-10 object-cover rounded"
                          muted
                          playsInline
                        />
                      ) : (
                        <img 
                          src={banner.image_url} 
                          alt={banner.title}
                          className="w-16 h-10 object-cover rounded"
                        />
                      )
                    ) : (
                      <div className="w-16 h-10 bg-gray-200 rounded flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{banner.title}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${banner.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {banner.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(banner)}
                      >
                        {banner.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(banner)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(banner.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default BannerManager;
