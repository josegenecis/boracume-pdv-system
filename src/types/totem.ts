export interface TotemThemeSettings {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  button_text_color: string;
  idle_overlay_color: string;
  cta_text: string;
  banner_interval_seconds: number;
}

export interface TotemBanner {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  media_url: string;
  orientation: 'both' | 'portrait' | 'landscape';
  active: boolean;
  display_order: number;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_TOTEM_THEME: TotemThemeSettings = {
  primary_color: '#EF6C20',
  secondary_color: '#073A2D',
  accent_color: '#85C441',
  background_color: '#FBF7EF',
  surface_color: '#FFFFFF',
  text_color: '#1C1917',
  button_text_color: '#FFFFFF',
  idle_overlay_color: '#05271F',
  cta_text: 'Toque para pedir',
  banner_interval_seconds: 7,
};

