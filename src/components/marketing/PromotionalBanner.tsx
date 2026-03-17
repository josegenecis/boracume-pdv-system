
import React, { useState, useEffect } from 'react';
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
}

interface PromotionalBannerProps {
  autoPlay?: boolean;
  interval?: number;
  restaurantId?: string;
  variant?: 'wide' | 'tile';
}

const PromotionalBanner: React.FC<PromotionalBannerProps> = ({ 
  autoPlay = true, 
  interval = 5000,
  restaurantId,
  variant = 'wide'
}) => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  const userId = restaurantId || user?.id;
  
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
          .select('id,title,description,image_url,link_url,active,display_order,start_date,end_date,banner_type')
          .eq('user_id', userId)
          .eq('active', true)
          .eq('banner_type', variant)
          .order('display_order') as any;
        promoBanners = res1.data as any;
        promoError = res1.error as any;

        if (promoError && String(promoError.message || '').includes('banner_type')) {
          const res2 = await supabase
            .from('promotional_banners')
            .select('id,title,description,image_url,link_url,active,display_order,start_date,end_date')
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
            bannerType: banner.banner_type
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
  
  useEffect(() => {
    if (!autoPlay || banners.length <= 1) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, interval);
    
    return () => clearInterval(timer);
  }, [autoPlay, interval, banners.length]);
  
  if (isLoading) {
    return (
      <div className="w-full h-48 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-gray-400">Carregando banners...</span>
      </div>
    );
  }
  
  if (banners.length === 0) {
    return null;
  }
  
  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + banners.length) % banners.length);
  };
  
  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
  };
  
  const currentBanner = banners[currentIndex];

  if (variant === 'tile') {
    return (
      <div className="w-full overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {banners.map((b) => (
            <a
              key={b.id}
              href={b.link || undefined}
              onClick={(e) => {
                if (!b.link) e.preventDefault();
              }}
              className="block w-40 sm:w-44 rounded-xl overflow-hidden shadow-sm border border-gray-100 bg-white"
            >
              <div className="aspect-[2/3] w-full bg-gray-100 relative">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${b.imageUrl})` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <div className="text-sm font-extrabold leading-tight line-clamp-2">{b.title}</div>
                  {b.description ? <div className="text-[11px] opacity-90 line-clamp-2 mt-1">{b.description}</div> : null}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-32 sm:h-36 overflow-hidden rounded-xl shadow-sm border border-gray-100">
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500"
        style={{ backgroundImage: `url(${currentBanner.imageUrl})` }}
      >
        <div className="absolute inset-0 bg-black/35" />
      </div>

      <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
        <h2 className="text-lg sm:text-xl font-extrabold mb-1 leading-tight">{currentBanner.title}</h2>
        {currentBanner.description ? <p className="text-xs sm:text-sm mb-2 line-clamp-2">{currentBanner.description}</p> : null}
        {currentBanner.link ? (
          <Button variant="secondary" size="sm" className="self-start">
            Ver oferta
          </Button>
        ) : null}
      </div>

      {banners.length > 1 ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 text-white hover:bg-black/50 rounded-full h-8 w-8"
            onClick={handlePrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white hover:bg-black/50 rounded-full h-8 w-8"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      ) : null}

      {banners.length > 1 ? (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-1">
          {banners.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full ${currentIndex === index ? 'bg-white' : 'bg-white/50'}`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      ) : null}

      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded">
        {variant === 'wide' ? '800x260 recomendado' : '600x900 recomendado'}
      </div>
    </div>
  );
};

export default PromotionalBanner;
