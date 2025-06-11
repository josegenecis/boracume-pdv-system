
import React from 'react';
import { useAppearanceSettings } from '@/hooks/useAppearanceSettings';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', variant = 'full', className = '' }) => {
  const { settings } = useAppearanceSettings();
  
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  // Get primary color for "Bora" based on appearance settings
  const getBoraColor = () => {
    switch (settings.primary_color) {
      case 'blue':
        return 'text-blue-600';
      case 'green':
        return 'text-green-600';
      case 'red':
        return 'text-red-600';
      case 'purple':
        return 'text-purple-600';
      case 'orange':
      default:
        return 'text-orange-500';
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      <div className={`flex items-center ${sizeClasses[size]} font-montserrat font-bold`}>
        <span className={getBoraColor()}>Bora</span>
        <span className="text-green-600">Cumê</span>
      </div>
    </div>
  );
};

export default Logo;
