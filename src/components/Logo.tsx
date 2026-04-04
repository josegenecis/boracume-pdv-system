
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'light' | 'dark'; // Adicionado para suportar fundos diferentes, se necessário
}

const svgSizeMap = {
  sm: { width: 100, height: 24 },
  md: { width: 140, height: 32 },
  lg: { width: 180, height: 44 }
};

const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', theme = 'light' }) => {
  const { width, height } = svgSizeMap[size];

  return (
    <div className={`flex items-center ${className}`}>
      <svg 
        width={width} 
        height={height} 
        viewBox="0 0 180 44" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="block"
      >
        <text 
          x="0" 
          y="32" 
          fontFamily="Sora, system-ui, sans-serif" 
          fontWeight="800" 
          fontSize="28" 
          letterSpacing="-0.5"
        >
          <tspan fill="#FF6400">Bora</tspan>
          <tspan fill="#85C441">Cumê</tspan>
        </text>
      </svg>
    </div>
  );
};

export default Logo;
