
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
    reduced_motion: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('appearance_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
        applySettings(data);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const saveSettings = async (newSettings: Partial<AppearanceSettings>) => {
    if (!user) return;

    setLoading(true);
    try {
      const updatedSettings = { ...settings, ...newSettings };
      
      const { error } = await supabase
        .from('appearance_settings')
        .upsert([{ user_id: user.id, ...updatedSettings }], { 
          onConflict: 'user_id' 
        });

      if (error) throw error;

      setSettings(updatedSettings);
      applySettings(updatedSettings);

      toast({
        title: "Configurações salvas",
        description: "As configurações de aparência foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações de aparência.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const applySettings = (settingsToApply: AppearanceSettings) => {
    const root = document.documentElement;
    
    // Aplicar tema
    document.documentElement.classList.toggle('dark', settingsToApply.theme === 'dark');
    
    // Aplicar cor primária
    const colorMap: Record<string, string> = {
      orange: '24.6 95% 53.1%',
      blue: '221.2 83.2% 53.3%',
      green: '142.1 76.2% 36.3%',
      red: '346.8 77.2% 49.8%',
      purple: '262.1 83.3% 57.8%'
    };
    
    if (colorMap[settingsToApply.primary_color]) {
      root.style.setProperty('--primary', colorMap[settingsToApply.primary_color]);
    }

    // Aplicar tamanho da fonte
    const fontSizeMap: Record<string, string> = {
      small: '14px',
      medium: '16px',
      large: '18px'
    };
    
    if (fontSizeMap[settingsToApply.font_size]) {
      root.style.setProperty('--base-font-size', fontSizeMap[settingsToApply.font_size]);
    }

    // Aplicar outras configurações
    root.classList.toggle('compact-mode', settingsToApply.compact_mode);
    root.classList.toggle('no-animations', !settingsToApply.show_animations);
    root.classList.toggle('high-contrast', settingsToApply.high_contrast);
    root.classList.toggle('reduced-motion', settingsToApply.reduced_motion);
  };

  return {
    settings,
    loading,
    saveSettings,
    loadSettings
  };
};
