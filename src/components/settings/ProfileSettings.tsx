
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
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
        .single();

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
        setProfileImage(data.logo_url || '');
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_logo.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurant-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('restaurant-images')
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

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const profileData = {
        id: user.id,
        restaurant_name: formData.restaurantName,
        description: formData.description,
        phone: formData.phone,
        address: formData.address,
        email: formData.email,
        website: formData.website,
        opening_hours: formData.openingHours,
        delivery_fee: parseFloat(formData.deliveryFee),
        minimum_order: parseFloat(formData.minimumOrder),
        logo_url: profileImage,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (error) throw error;
      
      toast({
        title: "Perfil salvo!",
        description: "As informações do restaurante foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o perfil. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>
            Configure as informações principais do seu restaurante
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profileImage} />
              <AvatarFallback>RS</AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <Button variant="outline" className="cursor-pointer" disabled={uploading}>
                  <Upload size={16} className="mr-2" />
                  {uploading ? 'Enviando...' : 'Alterar Logo'}
                </Button>
              </Label>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Imagens em PNG, JPG até 2MB
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

      <Card>
        <CardHeader>
          <CardTitle>Configurações de Delivery</CardTitle>
          <CardDescription>
            Configure horários e valores para delivery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opening-hours">Horário de Funcionamento</Label>
              <Input
                id="opening-hours"
                value={formData.openingHours}
                onChange={(e) => handleInputChange('openingHours', e.target.value)}
                placeholder="10:00 - 22:00"
              />
            </div>
            
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
        <Button onClick={handleSave} className="w-full md:w-auto" disabled={loading}>
          <Save size={16} className="mr-2" />
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
};

export default ProfileSettings;
