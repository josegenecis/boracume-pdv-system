
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ProfileSettings = () => {
  const [formData, setFormData] = useState({
    restaurantName: 'Restaurante Silva',
    description: 'O melhor restaurante da cidade com pratos deliciosos e atendimento excepcional.',
    phone: '(11) 99999-9999',
    address: 'Rua das Flores, 123 - Centro',
    email: 'contato@restaurantesilva.com',
    website: 'www.restaurantesilva.com',
    openingHours: '10:00 - 22:00',
    deliveryFee: '5.00',
    minimumOrder: '25.00'
  });
  
  const [profileImage, setProfileImage] = useState('https://github.com/shadcn.png');
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      toast({
        title: "Imagem carregada",
        description: "A imagem foi carregada com sucesso. Clique em salvar para confirmar as alterações.",
      });
    }
  };

  const handleSave = () => {
    // Aqui salvaria no banco de dados
    console.log('Dados do perfil:', formData);
    console.log('Imagem do perfil:', profileImage);
    
    toast({
      title: "Perfil salvo!",
      description: "As informações do restaurante foram atualizadas com sucesso.",
    });
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
          {/* Logo do Restaurante */}
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profileImage} />
              <AvatarFallback>RS</AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <Button variant="outline" className="cursor-pointer">
                  <Upload size={16} className="mr-2" />
                  Alterar Logo
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

          {/* Informações do Restaurante */}
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
        <Button onClick={handleSave} className="w-full md:w-auto">
          <Save size={16} className="mr-2" />
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
};

export default ProfileSettings;
