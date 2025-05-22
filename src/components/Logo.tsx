
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
}

const Logo: React.FC<LogoProps> = ({ size = 'md', variant = 'full' }) => {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className="flex items-center">
      <div className="text-boracume-orange font-montserrat font-bold">
        {variant === 'full' ? (
          <div className={`flex items-center ${sizeClasses[size]}`}>
            Bora<span className="text-boracume-green">Cumê</span>
          </div>
        ) : (
          <div className={`${sizeClasses[size]}`}>BC</div>
        )}
      </div>
    </div>
  );
};

export default Logo;
