
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AppearanceSettings {
  theme: 'light' | 'dark';
  primary_color: string;
  font_size: string;
  compact_mode: boolean;
  show_animations: boolean;
  high_contrast: boolean;
  reduced_motion: boolean;
}

const defaultSettings: AppearanceSettings = {
  theme: 'light',
  primary_color: '#3b82f6',
  font_size: 'medium',
  compact_mode: false,
  show_animations: true,
  high_contrast: false,
  reduced_motion: false,
};

export const useAppearanceSettings = () => {
  const [settings, setSettings] = useState<AppearanceSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load settings from localStorage and database
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // First try to load from localStorage
        const localSettings = localStorage.getItem('appearance_settings');
        if (localSettings) {
          const parsed = JSON.parse(localSettings);
          setSettings({ ...defaultSettings, ...parsed });
          applySettings({ ...defaultSettings, ...parsed });
        }

        // Then load from database
        const { data, error } = await supabase
          .from('appearance_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading appearance settings:', error);
        } else if (data) {
          const dbSettings: AppearanceSettings = {
            theme: (data.theme as 'light' | 'dark') || 'light',
            primary_color: data.primary_color || '#3b82f6',
            font_size: data.font_size || 'medium',
            compact_mode: data.compact_mode || false,
            show_animations: data.show_animations || true,
            high_contrast: data.high_contrast || false,
            reduced_motion: data.reduced_motion || false,
          };
          
          setSettings(dbSettings);
          applySettings(dbSettings);
          
          // Update localStorage
          localStorage.setItem('appearance_settings', JSON.stringify(dbSettings));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const applySettings = (newSettings: AppearanceSettings) => {
    // Apply theme
    if (newSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply primary color
    document.documentElement.style.setProperty('--primary', newSettings.primary_color);

    // Apply font size
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px'
    };
    document.documentElement.style.setProperty('--base-font-size', fontSizeMap[newSettings.font_size as keyof typeof fontSizeMap] || '16px');

    // Apply other settings as CSS custom properties
    document.documentElement.style.setProperty('--compact-mode', newSettings.compact_mode ? '1' : '0');
    document.documentElement.style.setProperty('--show-animations', newSettings.show_animations ? '1' : '0');
    document.documentElement.style.setProperty('--high-contrast', newSettings.high_contrast ? '1' : '0');
    document.documentElement.style.setProperty('--reduced-motion', newSettings.reduced_motion ? '1' : '0');
  };

  const updateSettings = async (newSettings: Partial<AppearanceSettings>) => {
    if (!user) return;

    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    applySettings(updatedSettings);

    // Save to localStorage immediately
    localStorage.setItem('appearance_settings', JSON.stringify(updatedSettings));

    try {
      // Save to database
      const { error } = await supabase
        .from('appearance_settings')
        .upsert({
          user_id: user.id,
          ...updatedSettings,
        });

      if (error) {
        console.error('Error saving appearance settings:', error);
        toast({
          title: "Erro ao salvar configurações",
          description: "Não foi possível salvar as configurações de aparência.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Configurações salvas",
          description: "As configurações de aparência foram salvas com sucesso.",
        });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erro ao salvar configurações",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
    }
  };

  return {
    settings,
    updateSettings,
    loading,
  };
};
