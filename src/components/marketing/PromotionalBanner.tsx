
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
}

const PromotionalBanner: React.FC<PromotionalBannerProps> = ({ 
  autoPlay = true, 
  interval = 5000 
}) => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  // Fetch banners from Supabase
  useEffect(() => {
    const fetchBanners = async () => {
      if (!user) {
        // Use default banners for non-authenticated users or before auth is loaded
        setBanners([
          {
            id: '1',
            imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
            title: 'Promoção Especial',
            description: 'Peça agora e ganhe 10% de desconto!',
          },
          {
            id: '2',
            imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0',
            title: 'Prato do Dia',
            description: 'Experimente nossa nova especialidade da casa',
          }
        ]);
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('marketing_settings')
          .select('banner_images')
          .eq('user_id', user.id)
          .single();
        
        if (error) throw error;
        
        if (data && data.banner_images && Array.isArray(data.banner_images) && data.banner_images.length > 0) {
          // Safely convert the JSON data to Banner objects
          const parsedBanners: Banner[] = [];
          
          for (const item of data.banner_images) {
            // Check if the item conforms to the Banner interface
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
          
          if (parsedBanners.length > 0) {
            setBanners(parsedBanners);
          } else {
            // Fallback to default banners if parsing failed
            setBanners(getDefaultBanners());
          }
        } else {
          // Default banners if none are configured
          setBanners(getDefaultBanners());
        }
      } catch (error) {
        console.error('Error fetching banners:', error);
        // Fallback to default banners on error
        setBanners(getDefaultBanners());
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBanners();
  }, [user]);
  
  // Function to get default banners
  const getDefaultBanners = (): Banner[] => {
    return [
      {
        id: '1',
        imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
        title: 'Promoção Especial',
        description: 'Peça agora e ganhe 10% de desconto!',
      },
      {
        id: '2',
        imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0',
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
      <div className="w-full h-64 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-gray-400">Carregando...</span>
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
    <div className="relative w-full h-64 overflow-hidden rounded-lg">
      {/* Banner Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500"
        style={{ backgroundImage: `url(${currentBanner.imageUrl})` }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40" />
      </div>
      
      {/* Banner Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">{currentBanner.title}</h2>
        {currentBanner.description && (
          <p className="mb-4">{currentBanner.description}</p>
        )}
        {currentBanner.link && (
          <Button variant="secondary" className="self-start">
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
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 text-white hover:bg-black/50 rounded-full"
            onClick={handlePrevious}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white hover:bg-black/50 rounded-full"
            onClick={handleNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}
      
      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-2">
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
    </div>
  );
};

export default PromotionalBanner;
