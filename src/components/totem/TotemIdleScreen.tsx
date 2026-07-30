import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, Expand, ShoppingBag, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import AutoplayVideo from '@/components/media/AutoplayVideo';
import { isVideoAsset } from '@/utils/videoAutoplay';
import { normalizeImageUrlForDisplay } from '@/utils/normalizeImageUrl';
import { DEFAULT_TOTEM_THEME, type TotemBanner, type TotemThemeSettings } from '@/types/totem';

interface IdleProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
}

interface IdleProfile {
  restaurant_name?: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
}

interface TotemIdleScreenProps {
  restaurantId: string;
  profile: IdleProfile | null;
  featuredProducts: IdleProduct[];
  isOnline: boolean;
  isFullscreen: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  settings?: TotemThemeSettings;
  onStart: () => void;
  onInstall: () => void;
  onToggleFullscreen: () => void;
}

interface IdleSlide {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  eyebrow: string;
  price?: number;
}

const isDateActive = (start?: string | null, end?: string | null) => {
  const now = Date.now();
  if (start && new Date(start).getTime() > now) return false;
  if (end && new Date(end).getTime() < now) return false;
  return true;
};

const formatBRL = (value: number) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TotemIdleScreen({
  restaurantId,
  profile,
  featuredProducts,
  isOnline,
  isFullscreen,
  isInstalled,
  canInstall,
  settings = DEFAULT_TOTEM_THEME,
  onStart,
  onInstall,
  onToggleFullscreen,
}: TotemIdleScreenProps) {
  const [banners, setBanners] = useState<TotemBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() =>
    window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'
  );

  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)');
    const updateOrientation = () => setOrientation(media.matches ? 'portrait' : 'landscape');
    updateOrientation();
    media.addEventListener?.('change', updateOrientation);
    return () => media.removeEventListener?.('change', updateOrientation);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBanners = async () => {
      const { data } = await supabase
        .from('totem_banners')
        .select('id,user_id,title,description,media_url,orientation,active,display_order,start_date,end_date')
        .eq('user_id', restaurantId)
        .eq('active', true)
        .order('display_order', { ascending: true });

      if (!cancelled) {
        setBanners(((data || []) as TotemBanner[]).filter((banner) => banner.media_url && isDateActive(banner.start_date, banner.end_date)));
      }
    };

    void loadBanners();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const slides = useMemo<IdleSlide[]>(() => {
    const promotionalSlides = banners
      .filter((banner) => banner.orientation === 'both' || banner.orientation === orientation)
      .map((banner) => ({
      id: `banner-${banner.id}`,
      title: banner.title || 'Uma experiência feita para você',
      description: banner.description || 'Toque na tela, escolha seus favoritos e faça seu pedido.',
      imageUrl: normalizeImageUrlForDisplay(banner.media_url) || '',
      eyebrow: 'Oferta em destaque',
      }));
    if (promotionalSlides.length > 0) return promotionalSlides;

    const productSlides = featuredProducts
      .filter((product) => normalizeImageUrlForDisplay(product.image_url))
      .map((product) => ({
        id: `product-${product.id}`,
        title: product.name,
        description: product.description || 'Preparado na hora para deixar seu pedido ainda melhor.',
        imageUrl: normalizeImageUrlForDisplay(product.image_url) || '',
        eyebrow: 'Experimente hoje',
        price: product.price,
      }));

    if (productSlides.length > 0) return productSlides;

    return [{
      id: 'restaurant-cover',
      title: profile?.restaurant_name || 'Seu pedido começa aqui',
      description: profile?.description || 'Escolha, personalize e pague direto no autoatendimento.',
      imageUrl: normalizeImageUrlForDisplay(profile?.banner_url) || '',
      eyebrow: 'Autoatendimento',
    }];
  }, [banners, featuredProducts, orientation, profile]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % slides.length);
    }, settings.banner_interval_seconds * 1000);
    return () => window.clearInterval(timer);
  }, [settings.banner_interval_seconds, slides.length]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [slides.length]);

  const slide = slides[currentIndex % slides.length];

  return (
    <section className="fixed inset-0 z-50 overflow-hidden text-white" style={{ backgroundColor: settings.secondary_color }}>
      <button type="button" className="absolute inset-0 block h-full w-full text-left" onClick={onStart} aria-label="Tocar para iniciar pedido">
        {slide.imageUrl ? (
          isVideoAsset(slide.imageUrl) ? (
            <AutoplayVideo key={slide.id} src={slide.imageUrl} className="h-full w-full object-cover" loop />
          ) : (
            <img key={slide.id} src={slide.imageUrl} alt="" className="h-full w-full animate-in fade-in duration-700 object-cover" />
          )
        ) : (
          <div
            className="h-full w-full"
            style={{ background: `radial-gradient(circle at 72% 22%, ${settings.primary_color}BF, transparent 30%), radial-gradient(circle at 18% 76%, ${settings.accent_color}85, transparent 34%), linear-gradient(145deg, ${settings.secondary_color}, #10261f)` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/85" />
        <div className="totem-idle-shade absolute inset-x-0 bottom-0 h-[62%]" style={{ background: `linear-gradient(to top, ${settings.idle_overlay_color}, ${settings.idle_overlay_color}B8, transparent)` }} />
      </button>

      <div className="totem-idle-header pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-4 rounded-2xl border border-white/15 bg-black/25 p-2.5 pr-5 backdrop-blur-xl">
          {profile?.logo_url ? (
            <img src={profile.logo_url} alt="" className="totem-idle-logo h-14 w-14 rounded-xl bg-white object-contain p-1" />
          ) : (
            <div className="totem-idle-logo flex h-14 w-14 items-center justify-center rounded-xl bg-white" style={{ color: settings.secondary_color }}><ShoppingBag className="h-7 w-7" /></div>
          )}
          <div className="totem-idle-brand truncate text-lg font-black">{profile?.restaurant_name || 'PopSystem Totem'}</div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className={`hidden h-12 items-center gap-2 rounded-full border px-4 text-sm font-bold backdrop-blur sm:flex ${isOnline ? 'border-white/15 bg-black/25 text-white' : 'border-red-300/30 bg-red-500/30 text-red-50'}`}>
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {isOnline ? 'Online' : 'Sem conexão'}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onToggleFullscreen} className="h-12 w-12 rounded-full border border-white/15 bg-black/25 text-white backdrop-blur hover:bg-white/20 hover:text-white" aria-label={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}>
            <Expand className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="totem-idle-content pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="totem-idle-layout mx-auto w-full max-w-[1500px]">
          <div className="max-w-4xl">
            <div className="totem-idle-eyebrow mb-3 text-sm font-black uppercase tracking-[.22em]" style={{ color: settings.accent_color }}>{slide.eyebrow}</div>
            <h1 className="totem-idle-title text-4xl font-black leading-[.98] drop-shadow-2xl">{slide.title}</h1>
            <p className="totem-idle-description mt-4 max-w-2xl text-base font-semibold leading-relaxed text-white/85">{slide.description}</p>
            {slide.price !== undefined ? <div className="totem-idle-price mt-4 text-3xl font-black" style={{ color: settings.price_color }}>A partir de {formatBRL(slide.price)}</div> : null}
          </div>

          <div className="totem-idle-action pointer-events-auto mt-8">
            <Button type="button" onClick={onStart} className="totem-idle-start h-20 w-full rounded-2xl px-8 text-xl font-black shadow-[0_22px_55px_rgba(0,0,0,.35)] brightness-100 hover:brightness-95" style={{ backgroundColor: settings.primary_color, color: settings.button_text_color }}>
              {settings.cta_text}
              <ArrowRight className="totem-idle-arrow ml-3 h-7 w-7" />
            </Button>
            {!isInstalled ? (
              <button type="button" onClick={onInstall} className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-white/70 hover:text-white">
                <Download className="h-4 w-4" />
                {canInstall ? 'Instalar aplicativo do totem' : 'Como instalar neste equipamento'}
              </button>
            ) : null}
          </div>
        </div>

        {slides.length > 1 ? (
          <div className="mx-auto mt-6 flex gap-2">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`pointer-events-auto h-2.5 rounded-full transition-all ${index === currentIndex ? 'w-10 bg-white' : 'w-2.5 bg-white/40'}`}
                aria-label={`Mostrar anúncio ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
