
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', variant = 'full', className = '' }) => {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className={`flex items-center ${className}`}>
      {variant === 'full' ? (
        <div className={`flex items-center ${sizeClasses[size]} font-montserrat font-bold`}>
          <span className="text-green-600">Bora</span>
          <span className="text-orange-600">Cumê</span>
        </div>
      ) : (
        <div className={`${sizeClasses[size]} font-montserrat font-bold`}>
          <span className="text-green-600">B</span>
          <span className="text-orange-600">C</span>
        </div>
      )}
    </div>
  );
};

export default Logo;
