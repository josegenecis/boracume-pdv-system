
import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Banner {
  id: string;
  imageUrl: string;
  title: string;
  description?: string;
  link?: string;
  bannerType?: 'wide' | 'tile';
  productId?: string | null;
}

interface PromotionalBannerProps {
  autoPlay?: boolean;
  interval?: number;
  restaurantId?: string;
  variant?: 'wide' | 'tile';
  onSelectProductId?: (productId: string) => void;
}

const PromotionalBanner: React.FC<PromotionalBannerProps> = ({ 
  autoPlay = true, 
  interval = 5000,
  restaurantId,
  variant = 'wide',
  onSelectProductId
}) => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  const userId = restaurantId || user?.id;

  const openLink = (href: string) => {
    const url = String(href || '').trim();
    if (!url) return;
    const isInternal = url.startsWith('/') || url.startsWith('#');
    if (isInternal) {
      window.location.href = url;
      return;
    }
    window.open(url, '_blank', 'noreferrer');
  };

  const handleBannerClick = (b: Banner) => {
    const pid = String(b.productId || '').trim();
    if (pid && typeof onSelectProductId === 'function') {
      onSelectProductId(pid);
      return;
    }
    const href = String(b.link || '').trim();
    if (href) openLink(href);
  };
  
  useEffect(() => {
    const fetchBanners = async () => {
      if (!userId) {
        setBanners(getDefaultBanners());
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);

        let promoBanners: any[] | null = null;
        let promoError: any = null;

        const res1 = await supabase
          .from('promotional_banners')
          .select('id,title,description,image_url,link_url,active,display_order,start_date,end_date,banner_type,product_id')
          .eq('user_id', userId)
          .eq('active', true)
          .eq('banner_type', variant)
          .order('display_order') as any;
        promoBanners = res1.data as any;
        promoError = res1.error as any;

        if (promoError && String(promoError.message || '').includes('banner_type')) {
          const res2 = await supabase
            .from('promotional_banners')
            .select('id,title,description,image_url,link_url,active,display_order,start_date,end_date,product_id')
            .eq('user_id', userId)
            .eq('active', true)
            .order('display_order') as any;
          promoBanners = res2.data as any;
          promoError = res2.error as any;
        }

        if (promoError) console.error('Erro ao buscar banners promocionais:', promoError);

        if (promoBanners && promoBanners.length > 0) {
          const convertedBanners: Banner[] = promoBanners.map(banner => ({
            id: banner.id,
            imageUrl: banner.image_url || '',
            title: banner.title,
            description: banner.description,
            link: banner.link_url,
            bannerType: banner.banner_type,
            productId: banner.product_id
          }));
          setBanners(convertedBanners);
        } else {
          const { data: marketingData, error: marketingError } = await supabase
            .from('marketing_settings')
            .select('banner_images')
            .eq('user_id', userId)
            .single();
          
          if (marketingError) {
            console.error('Erro ao buscar configurações de marketing:', marketingError);
            setBanners(getDefaultBanners());
          } else if (marketingData?.banner_images && Array.isArray(marketingData.banner_images) && marketingData.banner_images.length > 0) {
            const parsedBanners: Banner[] = [];
            
            for (const item of marketingData.banner_images) {
              if (
                typeof item === 'object' && 
                item !== null && 
                'id' in item && 
                'imageUrl' in item && 
                'title' in item
              ) {
                parsedBanners.push({
                  id: String(item.id),
                  imageUrl: String(item.imageUrl),
                  title: String(item.title),
                  description: 'description' in item ? String(item.description) : undefined,
                  link: 'link' in item ? String(item.link) : undefined
                });
              }
            }
            
            setBanners(parsedBanners.length > 0 ? parsedBanners : getDefaultBanners());
          } else {
            setBanners(getDefaultBanners());
          }
        }
      } catch (error) {
        console.error('Error fetching banners:', error);
        setBanners(getDefaultBanners());
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBanners();
  }, [userId]);
  
  const getDefaultBanners = (): Banner[] => {
    return [
      {
        id: '1',
        imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=300&fit=crop',
        title: 'Promoção Especial',
        description: 'Peça agora e ganhe 10% de desconto!',
        bannerType: 'wide'
      },
      {
        id: '2',
        imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=300&fit=crop',
        title: 'Prato do Dia',
        description: 'Experimente nossa nova especialidade da casa',
        bannerType: 'wide'
      }
    ];
  };

  const clickables = useMemo(() => {
    return banners.filter((b) => String(b.imageUrl || '').trim());
  }, [banners]);
  
  useEffect(() => {
    if (!autoPlay || banners.length <= 1) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, interval);
    
    return () => clearInterval(timer);
  }, [autoPlay, interval, banners.length]);
  
  if (isLoading) {
    return (
      <div className="w-full h-28 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-xs text-gray-400">Carregando banners...</span>
      </div>
    );
  }
  
  if (clickables.length === 0) {
    return null;
  }
  
  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + banners.length) % banners.length);
  };
  
  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
  };
  
  const currentBanner = clickables[currentIndex % clickables.length];

  if (variant === 'tile') {
    return (
      <div className="w-full overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {clickables.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => handleBannerClick(b)}
              className="block w-32 sm:w-36 rounded-lg overflow-hidden shadow-sm border border-gray-100 bg-white"
            >
              <div className="aspect-[2/3] w-full bg-gray-100 relative">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${b.imageUrl})` }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-24 sm:h-28 overflow-hidden rounded-lg shadow-sm border border-gray-100">
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500"
        style={{ backgroundImage: `url(${currentBanner.imageUrl})` }}
      />

      <button
        type="button"
        className="absolute inset-0"
        onClick={() => handleBannerClick(currentBanner)}
        aria-label="Banner promocional"
      />

      {clickables.length > 1 ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 text-white hover:bg-black/50 rounded-full h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevious();
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white hover:bg-black/50 rounded-full h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : null}

      {clickables.length > 1 ? (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-1">
          {clickables.map((_, index) => (
            <button
              key={index}
              className={`w-1.5 h-1.5 rounded-full ${currentIndex === index ? 'bg-white' : 'bg-white/50'}`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default PromotionalBanner;
