
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Monitor, Sun, Moon, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AppearanceSettings = () => {
  const [appearance, setAppearance] = useState({
    theme: 'light',
    primaryColor: 'orange',
    fontSize: 'medium',
    compactMode: false,
    showAnimations: true,
    highContrast: false,
    reducedMotion: false
  });

  const { toast } = useToast();

  const handleToggle = (field: string) => {
    setAppearance(prev => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev]
    }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setAppearance(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    // Aqui salvaria no banco de dados e aplicaria as mudanças
    console.log('Configurações de aparência:', appearance);
    
    toast({
      title: "Aparência atualizada!",
      description: "As configurações de aparência foram salvas com sucesso.",
    });
  };

  const colorOptions = [
    { value: 'orange', label: 'Laranja (Padrão)', color: 'bg-orange-500' },
    { value: 'blue', label: 'Azul', color: 'bg-blue-500' },
    { value: 'green', label: 'Verde', color: 'bg-green-500' },
    { value: 'purple', label: 'Roxo', color: 'bg-purple-500' },
    { value: 'red', label: 'Vermelho', color: 'bg-red-500' }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette size={24} />
            Tema e Cores
          </CardTitle>
          <CardDescription>
            Personalize a aparência do sistema conforme sua preferência
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Tema</Label>
            <Select
              value={appearance.theme}
              onValueChange={(value) => handleSelectChange('theme', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun size={16} />
                    Claro
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon size={16} />
                    Escuro
                  </div>
                </SelectItem>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <Monitor size={16} />
                    Automático (Sistema)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary-color">Cor Principal</Label>
            <Select
              value={appearance.primaryColor}
              onValueChange={(value) => handleSelectChange('primaryColor', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${option.color}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="font-size">Tamanho da Fonte</Label>
            <Select
              value={appearance.fontSize}
              onValueChange={(value) => handleSelectChange('fontSize', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Pequena</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="large">Grande</SelectItem>
                <SelectItem value="extra-large">Extra Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Layout e Comportamento</CardTitle>
          <CardDescription>
            Configure como o sistema se comporta e exibe informações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="compact-mode">Modo Compacto</Label>
              <p className="text-sm text-muted-foreground">
                Reduz o espaçamento entre elementos para mostrar mais informações
              </p>
            </div>
            <Switch
              id="compact-mode"
              checked={appearance.compactMode}
              onCheckedChange={() => handleToggle('compactMode')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-animations">Animações</Label>
              <p className="text-sm text-muted-foreground">
                Mostrar animações e transições suaves
              </p>
            </div>
            <Switch
              id="show-animations"
              checked={appearance.showAnimations}
              onCheckedChange={() => handleToggle('showAnimations')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acessibilidade</CardTitle>
          <CardDescription>
            Configurações para melhorar a acessibilidade do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="high-contrast">Alto Contraste</Label>
              <p className="text-sm text-muted-foreground">
                Aumenta o contraste entre texto e fundo para melhor legibilidade
              </p>
            </div>
            <Switch
              id="high-contrast"
              checked={appearance.highContrast}
              onCheckedChange={() => handleToggle('highContrast')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reduced-motion">Movimento Reduzido</Label>
              <p className="text-sm text-muted-foreground">
                Reduz animações e movimentos para usuários sensíveis a movimento
              </p>
            </div>
            <Switch
              id="reduced-motion"
              checked={appearance.reducedMotion}
              onCheckedChange={() => handleToggle('reducedMotion')}
            />
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

export default AppearanceSettings;
