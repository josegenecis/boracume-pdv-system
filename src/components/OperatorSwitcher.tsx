import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface Waiter {
  id: string;
  name: string;
  active: boolean;
}

export default function OperatorSwitcher() {
  const { user } = useAuth();
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [operatorId, setOperatorId] = useState<string>('');
  const [operatorName, setOperatorName] = useState<string>('');

  useEffect(() => {
    const session = localStorage.getItem('operator_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        setOperatorId(parsed.id || '');
        setOperatorName(parsed.name || '');
      } catch {}
    }
  }, []);

  useEffect(() => {
    const loadWaiters = async () => {
      try {
        const { data } = await supabase
          .from('waiters' as any)
          .select('id, name, active')
          .eq('user_id', user?.id)
          .order('name');
        setWaiters((data || []).filter((w: any) => w.active));
      } catch {}
    };
    if (user?.id) loadWaiters();
  }, [user?.id]);

  const handleChange = (id: string) => {
    setOperatorId(id);
    const found = waiters.find(w => w.id === id);
    const name = found?.name || '';
    setOperatorName(name);
    localStorage.setItem('operator_session', JSON.stringify({
      id,
      name,
      user_id: user?.id,
      set_at: new Date().toISOString()
    }));
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs">Operador</Badge>
      <Select value={operatorId} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder={operatorName || 'Selecionar operador'} />
        </SelectTrigger>
        <SelectContent>
          {waiters.map(w => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
