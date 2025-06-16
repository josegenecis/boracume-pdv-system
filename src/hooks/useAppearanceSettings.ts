
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AppearanceSettings {
  id?: string;
  user_id?: string;
  theme: 'light' | 'dark';
  primary_color: string;
  font_size: 'small' | 'medium' | 'large';
  reduced_motion: boolean;
  high_contrast: boolean;
  show_animations: boolean;
  compact_mode: boolean;
}

const defaultSettings: AppearanceSettings = {
  theme: 'light',
  primary_color: 'orange',
  font_size: 'medium',
  reduced_motion: false,
  high_contrast: false,
  show_animations: true,
  compact_mode: false,
};

export const useAppearanceSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppearanceSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else {
      // Carregar configurações do localStorage para usuários não logados
      loadFromLocalStorage();
    }
  }, [user]);

  // Aplicar configurações no DOM quando mudarem
  useEffect(() => {
    applySettingsToDOM();
  }, [settings]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('appearance_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar configurações:', error);
        return;
      }

      if (data) {
        const loadedSettings = {
          ...defaultSettings,
          ...data,
        };
        setSettings(loadedSettings);
        saveToLocalStorage(loadedSettings);
      } else {
        // Não há configurações salvas, usar padrão
        setSettings(defaultSettings);
        saveToLocalStorage(defaultSettings);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('appearance_settings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsedSettings });
      } else {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Erro ao carregar do localStorage:', error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const saveToLocalStorage = (settingsToSave: AppearanceSettings) => {
    try {
      localStorage.setItem('appearance_settings', JSON.stringify(settingsToSave));
    } catch (error) {
      console.error('Erro ao salvar no localStorage:', error);
    }
  };

  const applySettingsToDOM = () => {
    const root = document.documentElement;
    
    // Aplicar tema
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Aplicar cor primária
    const colorMap: Record<string, string> = {
      orange: '#f97316',
      blue: '#3b82f6',
      green: '#10b981',
      purple: '#8b5cf6',
      red: '#ef4444',
      pink: '#ec4899',
    };

    const colorValue = colorMap[settings.primary_color] || colorMap.orange;
    root.style.setProperty('--color-primary', colorValue);

    // Aplicar tamanho da fonte
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    root.style.setProperty('--font-size-base', fontSizeMap[settings.font_size]);

    // Aplicar outras configurações
    if (settings.reduced_motion) {
      root.style.setProperty('--animation-duration', '0.01ms');
    } else {
      root.style.removeProperty('--animation-duration');
    }

    if (settings.high_contrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (settings.compact_mode) {
      root.classList.add('compact-mode');
    } else {
      root.classList.remove('compact-mode');
    }
  };

  const updateSettings = async (newSettings: Partial<AppearanceSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    saveToLocalStorage(updatedSettings);

    if (!user) {
      // Para usuários não logados, apenas salvar no localStorage
      toast({
        title: "Configurações salvas localmente",
        description: "As configurações foram aplicadas e salvas no seu navegador.",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('appearance_settings')
        .upsert({
          user_id: user.id,
          ...updatedSettings,
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Erro ao salvar configurações:', error);
        toast({
          title: "Erro ao salvar configurações",
          description: "As configurações foram aplicadas mas não puderam ser salvas no servidor.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Configurações salvas com sucesso!",
        description: "Suas preferências de aparência foram atualizadas.",
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro ao salvar configurações",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    }
  };

  const resetToDefaults = async () => {
    await updateSettings(defaultSettings);
  };

  return {
    settings,
    loading,
    updateSettings,
    resetToDefaults,
  };
};
