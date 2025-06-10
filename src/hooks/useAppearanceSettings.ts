
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AppearanceSettings {
  theme: string;
  primary_color: string;
  font_size: string;
  compact_mode: boolean;
  show_animations: boolean;
  high_contrast: boolean;
  reduced_motion: boolean;
}

export const useAppearanceSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppearanceSettings>({
    theme: 'light',
    primary_color: 'orange',
    font_size: 'medium',
    compact_mode: false,
    show_animations: true,
    high_contrast: false,
    reduced_motion: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appearance_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          theme: data.theme || 'light',
          primary_color: data.primary_color || 'orange',
          font_size: data.font_size || 'medium',
          compact_mode: data.compact_mode || false,
          show_animations: data.show_animations || true,
          high_contrast: data.high_contrast || false,
          reduced_motion: data.reduced_motion || false,
        });
        
        // Aplicar configurações ao documento
        applySettings({
          theme: data.theme || 'light',
          primary_color: data.primary_color || 'orange',
          font_size: data.font_size || 'medium',
          compact_mode: data.compact_mode || false,
          show_animations: data.show_animations || true,
          high_contrast: data.high_contrast || false,
          reduced_motion: data.reduced_motion || false,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de aparência:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<AppearanceSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      
      const { error } = await supabase
        .from('appearance_settings')
        .upsert({
          user_id: user?.id,
          ...updatedSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSettings(updatedSettings);
      applySettings(updatedSettings);

      toast({
        title: "Configurações salvas",
        description: "As configurações de aparência foram atualizadas.",
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações de aparência.",
        variant: "destructive"
      });
    }
  };

  const applySettings = (settings: AppearanceSettings) => {
    // Aplicar tema
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Aplicar cor primária
    const root = document.documentElement;
    switch (settings.primary_color) {
      case 'blue':
        root.style.setProperty('--primary', '221 83% 53%');
        break;
      case 'green':
        root.style.setProperty('--primary', '142 76% 36%');
        break;
      case 'red':
        root.style.setProperty('--primary', '0 84% 60%');
        break;
      case 'purple':
        root.style.setProperty('--primary', '262 83% 58%');
        break;
      case 'orange':
      default:
        root.style.setProperty('--primary', '25 95% 53%');
        break;
    }

    // Aplicar tamanho da fonte
    switch (settings.font_size) {
      case 'small':
        root.style.setProperty('--font-size', '14px');
        break;
      case 'large':
        root.style.setProperty('--font-size', '18px');
        break;
      case 'medium':
      default:
        root.style.setProperty('--font-size', '16px');
        break;
    }

    // Aplicar outras configurações
    if (settings.reduced_motion) {
      root.style.setProperty('--animation-duration', '0s');
    } else {
      root.style.removeProperty('--animation-duration');
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    applySettings
  };
};
