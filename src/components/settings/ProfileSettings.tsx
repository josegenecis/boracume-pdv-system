
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, Save, Copy, Clock3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const weekDays = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

type WeekDayKey = typeof weekDays[number]['key'];

type DailySchedule = {
  open: string;
  close: string;
  closed: boolean;
};

const createDefaultSchedule = (): Record<WeekDayKey, DailySchedule> => ({
  monday: { open: '10:00', close: '22:00', closed: false },
  tuesday: { open: '10:00', close: '22:00', closed: false },
  wednesday: { open: '10:00', close: '22:00', closed: false },
  thursday: { open: '10:00', close: '22:00', closed: false },
  friday: { open: '10:00', close: '22:00', closed: false },
  saturday: { open: '10:00', close: '22:00', closed: false },
  sunday: { open: '10:00', close: '22:00', closed: false },
});

const normalizeSchedule = (value: any, fallback?: DailySchedule): DailySchedule => ({
  open: typeof value?.open === 'string' && value.open ? value.open : fallback?.open || '10:00',
  close: typeof value?.close === 'string' && value.close ? value.close : fallback?.close || '22:00',
  closed: Boolean(value?.closed),
});

const parseWeeklySchedule = (openingHours?: string | null): Record<WeekDayKey, DailySchedule> => {
  const defaults = createDefaultSchedule();
  if (!openingHours) return defaults;

  try {
    const parsed = JSON.parse(openingHours);
    if (parsed && typeof parsed === 'object') {
      return weekDays.reduce((acc, day) => {
        acc[day.key] = normalizeSchedule(parsed[day.key], defaults[day.key]);
        return acc;
      }, {} as Record<WeekDayKey, DailySchedule>);
    }
  } catch {}

  const match = String(openingHours).match(/(\d{2}:\d{2})\s*[-àa]+\s*(\d{2}:\d{2})/i);
  if (match) {
    const [, open, close] = match;
    return weekDays.reduce((acc, day) => {
      acc[day.key] = { open, close, closed: false };
      return acc;
    }, {} as Record<WeekDayKey, DailySchedule>);
  }

  return defaults;
};

const ProfileSettings = () => {
  const [formData, setFormData] = useState({
    restaurantName: '',
    description: '',
    phone: '',
    address: '',
    email: '',
    website: '',
    openingHours: '10:00 - 22:00',
    deliveryFee: '5.00',
    minimumOrder: '25.00'
  });
  
  const [profileImage, setProfileImage] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weeklySchedule, setWeeklySchedule] = useState<Record<WeekDayKey, DailySchedule>>(createDefaultSchedule());
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar perfil:', error);
        return;
      }

      if (data) {
        setFormData({
          restaurantName: data.restaurant_name || '',
          description: data.description || '',
          phone: data.phone || '',
          address: data.address || '',
          email: data.email || '',
          website: data.website || '',
          openingHours: data.opening_hours || '10:00 - 22:00',
          deliveryFee: data.delivery_fee?.toString() || '5.00',
          minimumOrder: data.minimum_order?.toString() || '25.00'
        });
        setWeeklySchedule(parseWeeklySchedule(data.opening_hours));
        setProfileImage(data.logo_url || '');
        setBannerImage(data.banner_url || '');
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateWeeklySchedule = (day: WeekDayKey, updates: Partial<DailySchedule>) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        ...updates
      }
    }));
  };

  const copyDayToAll = (sourceDay: WeekDayKey) => {
    setWeeklySchedule(prev => {
      const source = prev[sourceDay];
      return weekDays.reduce((acc, day) => {
        acc[day.key] = { ...source };
        return acc;
      }, {} as Record<WeekDayKey, DailySchedule>);
    });

    toast({
      title: 'Horários copiados',
      description: 'O horário selecionado foi aplicado para todos os dias.',
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione apenas arquivos de imagem.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_logo_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      setProfileImage(publicUrl);
      
      toast({
        title: "Imagem carregada",
        description: "A imagem foi carregada com sucesso. Clique em salvar para confirmar as alterações.",
      });
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer upload da imagem. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione apenas arquivos de imagem.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingBanner(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_banner_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      setBannerImage(publicUrl);

      toast({
        title: "Banner carregado",
        description: "O banner foi carregado com sucesso. Clique em salvar para confirmar as alterações.",
      });
    } catch (error) {
      console.error('Erro no upload do banner:', error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer upload do banner. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const parseMoney = (v: string) => {
        const cleaned = String(v || '').replace(',', '.').trim();
        const n = Number.parseFloat(cleaned);
        return Number.isFinite(n) ? n : 0;
      };

      const profileData = {
        id: user.id,
        restaurant_name: formData.restaurantName,
        description: formData.description,
        phone: formData.phone,
        address: formData.address,
        email: formData.email,
        website: formData.website,
        opening_hours: JSON.stringify(weeklySchedule),
        delivery_fee: parseMoney(formData.deliveryFee),
        minimum_order: parseMoney(formData.minimumOrder),
        logo_url: profileImage,
        banner_url: bannerImage,
        updated_at: new Date().toISOString()
      };

      const trySave = async (data: any) => {
        const { id, ...updateData } = data;
        const upd = await supabase.from('profiles').update(updateData).eq('id', id).select('id');
        const updateError = (upd as any).error;
        if (updateError) return updateError;
        const updatedRows = (upd as any).data;
        if (Array.isArray(updatedRows) && updatedRows.length > 0) return null;
        const ins = await supabase.from('profiles').insert(data);
        return (ins as any).error;
      };

      let error = await trySave(profileData);

      if (error && String((error as any)?.message || '').toLowerCase().includes('jwt')) {
        try {
          await supabase.auth.refreshSession();
          error = await trySave(profileData);
        } catch {}
      }

      const msg = String((error as any)?.message || '');
      if (error && (msg.includes('banner_url') || String((error as any)?.details || '').includes('banner_url'))) {
        const { banner_url, ...withoutBanner } = profileData as any;
        error = await trySave(withoutBanner);
        if (!error && bannerImage) {
          toast({
            title: "Perfil salvo",
            description: "Salvei o perfil. Para salvar o banner, aplique a atualização do banco (banner_url).",
          });
          return;
        }
      }

      if (error) throw error;
      
      toast({
        title: "Perfil salvo!",
        description: "As informações do restaurante foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: String((error as any)?.message || "Não foi possível salvar o perfil. Tente novamente."),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-[#FF6400]/12 bg-gradient-to-br from-[#FFF8F2] via-white to-[#F5EBE1]/60 shadow-[0_20px_50px_-36px_rgba(0,50,35,0.18)]">
        <CardHeader className="border-b border-[#FF6400]/10 bg-white/70">
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>
            Configure as informações principais do seu restaurante
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profileImage} />
              <AvatarFallback>RS</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <Button variant="outline" className="cursor-pointer border-[#FF6400]/15 bg-white/85 text-[#003223] hover:bg-[#F5EBE1]" disabled={uploading} asChild>
                  <span>
                    <Upload size={16} className="mr-2" />
                    {uploading ? 'Enviando...' : 'Alterar Logo'}
                  </span>
                </Button>
              </Label>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: JPG, PNG, WebP, GIF (máx. 5MB)
                </p>
                <p className="text-xs text-blue-600 font-medium">
                  Tamanho recomendado: 200x200px (formato quadrado)
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Banner do Restaurante</Label>
            <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border border-[#FF6400]/10 bg-[#FFF8F2] md:h-32">
              {bannerImage ? (
                <img src={bannerImage} alt="Banner" className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs text-muted-foreground">Nenhum banner cadastrado</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="banner-upload" className="cursor-pointer">
                <Button variant="outline" className="cursor-pointer border-[#FF6400]/15 bg-white/85 text-[#003223] hover:bg-[#F5EBE1]" disabled={uploadingBanner} asChild>
                  <span>
                    <Upload size={16} className="mr-2" />
                    {uploadingBanner ? 'Enviando...' : 'Alterar Banner'}
                  </span>
                </Button>
              </Label>
              <input
                id="banner-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBannerUpload}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, WebP, GIF (máx. 10MB)
              </p>
              <p className="text-xs text-blue-600 font-medium">
                Tamanho recomendado: 1200x400px (formato horizontal)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="restaurant-name">Nome do Restaurante</Label>
              <Input
                id="restaurant-name"
                value={formData.restaurantName}
                onChange={(e) => handleInputChange('restaurantName', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço Completo</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição do Restaurante</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[#8CC850]/20 bg-gradient-to-br from-[#F5EBE1]/85 via-white to-[#8CC850]/10 shadow-[0_20px_50px_-36px_rgba(0,50,35,0.2)]">
        <CardHeader className="border-b border-[#8CC850]/15 bg-white/70">
          <CardTitle>Configurações de Delivery</CardTitle>
          <CardDescription>
            Configure horários e valores para delivery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[#FF6400]" />
              <Label>Horário de Funcionamento por Dia</Label>
            </div>
            <div className="space-y-3 rounded-2xl border border-[#8CC850]/18 bg-gradient-to-br from-[#FFF8F2] via-white to-[#8CC850]/10 p-3">
              {weekDays.map((day) => {
                const current = weeklySchedule[day.key];
                return (
                  <div key={day.key} className="grid gap-3 rounded-xl border border-[#FF6400]/10 bg-white/90 p-3 md:grid-cols-[90px_1fr_1fr_auto_auto] md:items-center">
                    <div className="text-sm font-semibold text-[#003223]">{day.label}</div>
                    <div className="flex items-center gap-2 rounded-xl border border-[#FF6400]/10 bg-[#FFF8F2]/85 px-3 py-2">
                      <Label htmlFor={`${day.key}-open`} className="shrink-0 text-xs font-semibold text-[#003223]/65">Abre</Label>
                      <Input
                        id={`${day.key}-open`}
                        type="time"
                        value={current.open}
                        disabled={current.closed}
                        onChange={(e) => updateWeeklySchedule(day.key, { open: e.target.value })}
                        className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-[#FF6400]/10 bg-[#FFF8F2]/85 px-3 py-2">
                      <Label htmlFor={`${day.key}-close`} className="shrink-0 text-xs font-semibold text-[#003223]/65">Fecha</Label>
                      <Input
                        id={`${day.key}-close`}
                        type="time"
                        value={current.close}
                        disabled={current.closed}
                        onChange={(e) => updateWeeklySchedule(day.key, { close: e.target.value })}
                        className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#8CC850]/20 bg-[#8CC850]/10 px-3 py-2">
                      <Label htmlFor={`${day.key}-closed`} className="text-sm font-medium text-[#003223]">Fechado</Label>
                      <Switch
                        id={`${day.key}-closed`}
                        checked={current.closed}
                        onCheckedChange={(checked) => updateWeeklySchedule(day.key, { closed: checked })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl border-[#FF6400]/15 bg-white text-[#003223] hover:bg-[#F5EBE1]"
                      onClick={() => copyDayToAll(day.key)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar para todos
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-fee">Taxa de Entrega (R$)</Label>
              <Input
                id="delivery-fee"
                type="number"
                step="0.01"
                value={formData.deliveryFee}
                onChange={(e) => handleInputChange('deliveryFee', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="minimum-order">Pedido Mínimo (R$)</Label>
              <Input
                id="minimum-order"
                type="number"
                step="0.01"
                value={formData.minimumOrder}
                onChange={(e) => handleInputChange('minimumOrder', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="w-full md:w-auto rounded-xl bg-[#8CC850] text-[#003223] hover:bg-[#79b541]" disabled={loading}>
          <Save size={16} className="mr-2" />
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
};

export default ProfileSettings;
