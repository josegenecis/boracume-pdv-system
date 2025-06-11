
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

  // Use CSS custom properties that change with appearance settings
  const getBoraStyles = () => {
    return {
      color: 'hsl(var(--primary))'
    };
  };

  return (
    <div className={`flex items-center ${className}`}>
      <div className={`flex items-center ${sizeClasses[size]} font-montserrat font-bold`}>
        <span style={getBoraStyles()}>Bora</span>
        <span className="text-green-600">Cumê</span>
      </div>
    </div>
  );
};

export default Logo;
