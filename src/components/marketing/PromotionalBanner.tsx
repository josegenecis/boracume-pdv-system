
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
}

interface PromotionalBannerProps {
  autoPlay?: boolean;
  interval?: number;
  restaurantId?: string; // Para uso no cardápio digital
}

const PromotionalBanner: React.FC<PromotionalBannerProps> = ({ 
  autoPlay = true, 
  interval = 5000,
  restaurantId 
}) => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  // Usar restaurantId se fornecido, caso contrário usar user.id
  const userId = restaurantId || user?.id;
  
  // Fetch banners from Supabase
  useEffect(() => {
    const fetchBanners = async () => {
      if (!userId) {
        // Use default banners for non-authenticated users
        setBanners(getDefaultBanners());
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Buscar banners promocionais da tabela promotional_banners
        const { data: promoBanners, error: promoError } = await supabase
          .from('promotional_banners')
          .select('*')
          .eq('user_id', userId)
          .eq('active', true)
          .order('display_order');

        if (promoError) {
          console.error('Erro ao buscar banners promocionais:', promoError);
        }

        if (promoBanners && promoBanners.length > 0) {
          const convertedBanners: Banner[] = promoBanners.map(banner => ({
            id: banner.id,
            imageUrl: banner.image_url || '',
            title: banner.title,
            description: banner.description,
            link: banner.link_url
          }));
          setBanners(convertedBanners);
        } else {
          // Fallback para marketing_settings se não houver banners promocionais
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
  
  // Function to get default banners
  const getDefaultBanners = (): Banner[] => {
    return [
      {
        id: '1',
        imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=300&fit=crop',
        title: 'Promoção Especial',
        description: 'Peça agora e ganhe 10% de desconto!',
      },
      {
        id: '2',
        imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=300&fit=crop',
        title: 'Prato do Dia',
        description: 'Experimente nossa nova especialidade da casa',
      }
    ];
  };
  
  // Auto-play functionality
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

  return (
    <div className="relative w-full h-48 overflow-hidden rounded-lg shadow-lg">
      {/* Banner Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500"
        style={{ backgroundImage: `url(${currentBanner.imageUrl})` }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40" />
      </div>
      
      {/* Banner Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
        <h2 className="text-xl font-bold mb-1">{currentBanner.title}</h2>
        {currentBanner.description && (
          <p className="text-sm mb-2">{currentBanner.description}</p>
        )}
        {currentBanner.link && (
          <Button variant="secondary" size="sm" className="self-start">
            Saiba mais
          </Button>
        )}
      </div>
      
      {/* Navigation Controls */}
      {banners.length > 1 && (
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
      )}
      
      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-1">
          {banners.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full ${
                currentIndex === index ? 'bg-white' : 'bg-white/50'
              }`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
      
      {/* Indicação de tamanho recomendado */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
        800x300px recomendado
      </div>
    </div>
  );
};

export default PromotionalBanner;
