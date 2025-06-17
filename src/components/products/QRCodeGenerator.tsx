
import React from 'react';

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  title?: string;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ 
  value, 
  size = 200, 
  title = "QR Code" 
}) => {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;

  return (
    <div className="flex flex-col items-center space-y-2">
      {title && <h3 className="text-sm font-medium">{title}</h3>}
      <div className="p-2 bg-white rounded-lg shadow-sm border">
        <img 
          src={qrCodeUrl} 
          alt={title}
          className={`w-${size/4} h-${size/4}`}
          style={{ width: size, height: size }}
        />
      </div>
    </div>
  );
};

export default QRCodeGenerator;
