
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'light' | 'dark';
}

const logoSizeMap = {
  sm: { width: 110, height: 28 },
  md: { width: 160, height: 40 },
  lg: { width: 220, height: 56 }
};

const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', theme = 'light' }) => {
  const { width, height } = logoSizeMap[size];
  const accentClass = theme === 'dark' ? 'drop-shadow-[0_4px_14px_rgba(0,0,0,0.28)]' : '';

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/LOGOMARCA/logo-sistema.png"
        alt="BoraCumê"
        width={width}
        height={height}
        className={`block h-auto max-h-full w-auto object-contain ${accentClass}`}
      />
    </div>
  );
};

export default Logo;
