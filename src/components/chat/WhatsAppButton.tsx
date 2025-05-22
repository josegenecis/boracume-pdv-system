
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface WhatsAppButtonProps {
  phoneNumber: string;
  message?: string;
  position?: 'right' | 'left';
  buttonText?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  phoneNumber,
  message = 'Olá! Estou com uma dúvida sobre o cardápio.',
  position = 'right',
  buttonText = 'Fale Conosco',
  color = '#25D366',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const positionClass = position === 'right' ? 'right-4' : 'left-4';
  
  const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-12 w-12',
    lg: 'h-14 w-14',
  };
  
  const iconSizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-7 w-7',
  };
  
  const handleWhatsAppClick = () => {
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');
  };
  
  return (
    <div className={`fixed bottom-4 ${positionClass} z-50`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            className={`rounded-full ${sizeClasses[size]} shadow-lg flex items-center justify-center p-0`}
            style={{ backgroundColor: color }}
          >
            <MessageCircle className={`text-white ${iconSizeClasses[size]}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" side="top">
          <div className="p-4" style={{ backgroundColor: color }}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-white">{buttonText}</h3>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-white hover:bg-white/20 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-white/90">
              Olá! Clique no botão abaixo para iniciar uma conversa no WhatsApp.
            </p>
          </div>
          <div className="p-4">
            <Button 
              className="w-full"
              style={{ backgroundColor: color }}
              onClick={handleWhatsAppClick}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Iniciar Conversa
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default WhatsAppButton;
