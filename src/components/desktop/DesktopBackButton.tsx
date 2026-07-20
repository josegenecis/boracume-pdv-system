import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function DesktopBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

  if (!isDesktop || location.pathname === '/dashboard') return null;

  return (
    <div className="mb-3 flex items-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigate(-1)}
        className="gap-2 rounded-xl border-slate-200 bg-white text-[#003223] shadow-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
    </div>
  );
}
