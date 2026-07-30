import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_TOTEM_THEME, type TotemThemeSettings } from '@/types/totem';

const normalizeSettings = (value: Partial<TotemThemeSettings> | null | undefined): TotemThemeSettings => ({
  ...DEFAULT_TOTEM_THEME,
  ...(value || {}),
  banner_interval_seconds: Math.min(
    30,
    Math.max(4, Number(value?.banner_interval_seconds || DEFAULT_TOTEM_THEME.banner_interval_seconds)),
  ),
});

export function useTotemTheme(restaurantId: string) {
  const [settings, setSettings] = useState<TotemThemeSettings>(DEFAULT_TOTEM_THEME);
  const [isLoading, setIsLoading] = useState(Boolean(restaurantId));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!restaurantId) {
        setSettings(DEFAULT_TOTEM_THEME);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('totem_settings')
        .select('*')
        .eq('user_id', restaurantId)
        .maybeSingle();

      if (!cancelled) {
        if (!error && data) setSettings(normalizeSettings(data));
        else setSettings(DEFAULT_TOTEM_THEME);
        setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const cssVariables = useMemo(() => ({
    '--totem-primary': settings.primary_color,
    '--totem-secondary': settings.secondary_color,
    '--totem-accent': settings.accent_color,
    '--totem-background': settings.background_color,
    '--totem-surface': settings.surface_color,
    '--totem-text': settings.text_color,
    '--totem-price': settings.price_color,
    '--totem-button-text': settings.button_text_color,
    '--totem-idle-overlay': settings.idle_overlay_color,
    '--menu-primary': settings.primary_color,
    '--menu-price': settings.price_color,
  }), [settings]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = new Map<string, string>();

    Object.entries(cssVariables).forEach(([name, value]) => {
      previous.set(name, root.style.getPropertyValue(name));
      root.style.setProperty(name, value);
    });

    return () => {
      previous.forEach((value, name) => {
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      });
    };
  }, [cssVariables]);

  return { settings, cssVariables, isLoading };
}
