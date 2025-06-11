
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Monitor, Globe } from 'lucide-react';

const DesktopIndicator: React.FC = () => {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  return (
    <Badge 
      variant={isElectron ? "default" : "secondary"}
      className="flex items-center gap-1"
    >
      {isElectron ? (
        <>
          <Monitor size={12} />
          Desktop
        </>
      ) : (
        <>
          <Globe size={12} />
          Web
        </>
      )}
    </Badge>
  );
};

export default DesktopIndicator;
