
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, X } from 'lucide-react';

interface PromotionalBannerProps {
  title: string;
  description?: string;
  imageUrl?: string;
  link?: string;
  position?: 'top' | 'middle' | 'bottom';
  onClose?: () => void;
}

const PromotionalBanner: React.FC<PromotionalBannerProps> = ({
  title,
  description,
  imageUrl,
  link,
  position = 'top',
  onClose,
}) => {
  const positionStyles = {
    top: 'mb-4',
    middle: 'my-4',
    bottom: 'mt-4',
  };
  
  return (
    <Card className={`overflow-hidden ${positionStyles[position]} relative`}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      
      <div className="relative">
        {imageUrl && (
          <div className="relative h-32 sm:h-48 overflow-hidden">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex flex-col justify-center px-6 text-white">
              <h3 className="text-xl sm:text-2xl font-bold">{title}</h3>
              {description && (
                <p className="text-sm sm:text-base mt-2 max-w-md">{description}</p>
              )}
              {link && (
                <Button 
                  variant="outline" 
                  className="mt-3 w-fit text-white border-white hover:bg-white/20 hover:text-white"
                  asChild
                >
                  <a href={link}>
                    Ver promoção
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
        
        {!imageUrl && (
          <CardContent className="bg-gradient-to-r from-orange-500 to-orange-400 text-white p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-bold">{title}</h3>
                {description && <p className="text-sm sm:text-base mt-1 max-w-md">{description}</p>}
              </div>
              {link && (
                <Button 
                  variant="outline" 
                  className="mt-3 sm:mt-0 w-fit text-white border-white hover:bg-white/20 hover:text-white"
                  asChild
                >
                  <a href={link}>
                    Ver promoção
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </div>
    </Card>
  );
};

export default PromotionalBanner;
