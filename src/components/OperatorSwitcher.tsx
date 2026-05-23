import React, { useEffect, useState } from 'react';
import { LogIn, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { clearLocalOperatorSession, getLocalOperatorSession, OperatorSession } from '@/services/operatorAuth';

export default function OperatorSwitcher() {
  const navigate = useNavigate();
  const [operator, setOperator] = useState<OperatorSession | null>(() => getLocalOperatorSession());

  useEffect(() => {
    const sync = () => setOperator(getLocalOperatorSession());
    window.addEventListener('storage', sync);
    window.addEventListener('operator-session-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('operator-session-changed', sync);
    };
  }, []);

  const switchOperator = () => {
    clearLocalOperatorSession();
    window.dispatchEvent(new Event('operator-session-changed'));
    navigate('/operator-login', { replace: true });
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="h-9 rounded-xl border-[#DCE6DF] bg-white px-3 text-xs font-semibold text-[#003223] shadow-sm">
        <UserRound className="mr-1.5 h-3.5 w-3.5" />
        {operator?.name || 'Sem operador'}
      </Badge>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={switchOperator}
        className="h-9 rounded-xl border-[#DCE6DF] bg-white px-3 text-xs font-semibold text-[#003223] shadow-sm hover:bg-[#F5F8F6]"
      >
        <LogIn className="mr-1.5 h-3.5 w-3.5" />
        Trocar
      </Button>
    </div>
  );
}
