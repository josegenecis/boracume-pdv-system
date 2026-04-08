
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'light' | 'dark';
}

const logoSizeMap = {
  sm: { width: 100, height: 24 },
  md: { width: 140, height: 32 },
  lg: { width: 180, height: 44 }
};

const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', theme = 'light' }) => {
  const { width, height } = logoSizeMap[size];
  const accentClass = theme === 'dark' ? 'drop-shadow-[0_4px_14px_rgba(0,0,0,0.28)]' : '';
  const logoSrc = `${import.meta.env.BASE_URL}LOGOMARCA/logo-sistema.png`;

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={logoSrc}
        alt=""
        aria-label="BoraCumê"
        className={`block shrink-0 object-contain ${accentClass}`}
        style={{ height: `${height}px`, width: 'auto', maxWidth: `${width}px` }}
      />
    </div>
  );
};

export default Logo;
