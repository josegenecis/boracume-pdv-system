
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Monitor, Sun, Moon, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  useEffect(() => {
    applyThemeChanges();
  }, [appearance]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('appearance_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar configurações:', error);
        return;
      }

      if (data) {
        setAppearance({
          theme: data.theme,
          primaryColor: data.primary_color,
          fontSize: data.font_size,
          compactMode: data.compact_mode,
          showAnimations: data.show_animations,
          highContrast: data.high_contrast,
          reducedMotion: data.reduced_motion
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const applyThemeChanges = () => {
    const root = document.documentElement;
    
    // Aplicar tema
    if (appearance.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Aplicar cor principal
    const colorMap = {
      orange: { primary: '25 25 112', accent: '255 127 80' },
      blue: { primary: '37 99 235', accent: '147 197 253' },
      green: { primary: '34 197 94', accent: '134 239 172' },
      purple: { primary: '147 51 234', accent: '196 181 253' },
      red: { primary: '239 68 68', accent: '248 113 113' }
    };

    const colors = colorMap[appearance.primaryColor as keyof typeof colorMap];
    if (colors) {
      root.style.setProperty('--primary', colors.primary);
      root.style.setProperty('--accent', colors.accent);
    }

    // Aplicar tamanho da fonte
    const fontSizes = {
      small: '14px',
      medium: '16px',
      large: '18px',
      'extra-large': '20px'
    };
    root.style.fontSize = fontSizes[appearance.fontSize as keyof typeof fontSizes];

    // Aplicar modo compacto
    if (appearance.compactMode) {
      root.classList.add('compact-mode');
    } else {
      root.classList.remove('compact-mode');
    }

    // Aplicar alto contraste
    if (appearance.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Aplicar movimento reduzido
    if (appearance.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Aplicar animações
    if (!appearance.showAnimations) {
      root.classList.add('no-animations');
    } else {
      root.classList.remove('no-animations');
    }
  };

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

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: existingData } = await supabase
        .from('appearance_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const settingsData = {
        user_id: user.id,
        theme: appearance.theme,
        primary_color: appearance.primaryColor,
        font_size: appearance.fontSize,
        compact_mode: appearance.compactMode,
        show_animations: appearance.showAnimations,
        high_contrast: appearance.highContrast,
        reduced_motion: appearance.reducedMotion,
        updated_at: new Date().toISOString()
      };

      if (existingData) {
        const { error } = await supabase
          .from('appearance_settings')
          .update(settingsData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('appearance_settings')
          .insert(settingsData);

        if (error) throw error;
      }
      
      toast({
        title: "Aparência atualizada!",
        description: "As configurações de aparência foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
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
        <Button onClick={handleSave} className="w-full md:w-auto" disabled={loading}>
          <Save size={16} className="mr-2" />
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
};

export default AppearanceSettings;
