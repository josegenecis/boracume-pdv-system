
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Monitor, Globe, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const DesktopStatus: React.FC = () => {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  if (isElectron) {
    return (
      <Badge variant="default" className="flex items-center gap-1">
        <Monitor size={12} />
        Desktop App
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="flex items-center gap-1">
        <Globe size={12} />
        Web
      </Badge>
      <Button asChild variant="outline" size="sm">
        <Link to="/downloads" className="flex items-center gap-1">
          <Download size={12} />
          Baixar App
        </Link>
      </Button>
    </div>
  );
};

export default DesktopStatus;
