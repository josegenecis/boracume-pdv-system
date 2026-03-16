
import React from 'react';
import { appLogoCandidates } from '@/config/branding';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-4xl'
};

const imgSizeMap = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10'
};

const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const [idx, setIdx] = React.useState(0);
  const src = appLogoCandidates[idx] || '';

  if (!src) {
    return (
      <div className={`flex items-center ${sizeMap[size]} font-montserrat font-bold ${className}`}>
        <span className="text-boracume-orange">Bora</span>
        <span className="text-boracume-green">Cumê</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={src}
        alt="BoraCumê"
        className={`${imgSizeMap[size]} w-auto`}
        onError={() => setIdx((v) => v + 1)}
        draggable={false}
      />
    </div>
  );
};

export default Logo;
