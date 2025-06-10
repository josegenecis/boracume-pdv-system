
import React from 'react';

interface PaymentIconProps {
  method: string;
  size?: number;
  className?: string;
}

const PaymentIcon: React.FC<PaymentIconProps> = ({ method, size = 24, className = "" }) => {
  const iconSize = size;
  
  switch (method.toLowerCase()) {
    case 'pix':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" className={className}>
          <path
            fill="currentColor"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.73 2.05-2.56 2.05H13.5v2.61c0 .26-.11.8-.36 1.06-.25.26-.74.44-1.15.44-.41 0-.9-.18-1.15-.44-.25-.26-.36-.8-.36-1.06V10.85H9.93c-1.83 0-2.41-.47-2.56-2.05-.08-.84.18-1.24.64-1.24.46 0 .72.4.8 1.24.03.33.22.51.6.51h1.06V6.7c0-.26.11-.8.36-1.06.25-.26.74-.44 1.15-.44.41 0 .9.18 1.15.44.25.26.36.8.36 1.06v2.61h1.06c.38 0 .57-.18.6-.51.08-.84.34-1.24.8-1.24.46 0 .72.4.64 1.24z"
          />
        </svg>
      );
    
    case 'cartao':
    case 'cartão':
    case 'credito':
    case 'crédito':
    case 'debito':
    case 'débito':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" className={className}>
          <path
            fill="currentColor"
            d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"
          />
        </svg>
      );
    
    case 'dinheiro':
    case 'money':
    case 'cash':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" className={className}>
          <path
            fill="currentColor"
            d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"
          />
        </svg>
      );
    
    default:
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" className={className}>
          <path
            fill="currentColor"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
          />
        </svg>
      );
  }
};

export default PaymentIcon;
