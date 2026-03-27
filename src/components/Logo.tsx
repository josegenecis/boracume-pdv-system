
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'light' | 'dark'; // Adicionado para suportar fundos diferentes, se necessário
}

const svgSizeMap = {
  sm: { width: 80, height: 24 },
  md: { width: 110, height: 32 },
  lg: { width: 150, height: 44 }
};

const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', theme = 'light' }) => {
  const { width, height } = svgSizeMap[size];
  const textColor = theme === 'dark' ? '#FFFFFF' : '#063D2E'; // boracume-dark-green para texto claro

  return (
    <div className={`flex items-center ${className}`}>
      <svg 
        width={width} 
        height={height} 
        viewBox="0 0 150 44" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="block"
      >
        {/* Símbolo "P" em estilo rústico/Pomar */}
        <path 
          d="M15 8C20.5228 8 25 12.4772 25 18C25 21.8488 22.8252 25.1887 19.5 26.833V36H10.5V26.833C7.17482 25.1887 5 21.8488 5 18C5 12.4772 9.47715 8 15 8Z" 
          fill="#85C441" /* boracume-green */
        />
        <path 
          d="M25 18C25 21.8488 22.8252 25.1887 19.5 26.833V36H10.5V26.833C7.17482 25.1887 5 21.8488 5 18C5 12.4772 9.47715 8 15 8C20.5228 8 25 12.4772 25 18ZM15 11C11.134 11 8 14.134 8 18C8 21.866 11.134 25 15 25C18.866 25 22 21.866 22 18C22 14.134 18.866 11 15 11Z" 
          fill="#EF6C20" /* boracume-orange */
        />
        <rect x="13.5" y="5" width="3" height="34" rx="1.5" fill="#EF6C20" />
        <rect x="5" y="16.5" width="20" height="3" rx="1.5" fill="#EF6C20" />

        {/* Texto "pomar" em fonte limpa e arredondada (simulando a Sora) */}
        <text 
          x="35" 
          y="30" 
          fontFamily="Sora, system-ui, sans-serif" 
          fontWeight="700" 
          fontSize="24" 
          fill={textColor}
          letterSpacing="-0.5"
        >
          pomar
        </text>
      </svg>
    </div>
  );
};

export default Logo;
