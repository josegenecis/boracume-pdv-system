
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-4xl'
};

const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => (
  <div className={`flex items-center ${sizeMap[size]} font-montserrat font-bold ${className}`}>
    <span className="text-boracume-orange">Bora</span>
    <span className="text-boracume-green">Cumê</span>
  </div>
);

export default Logo;
