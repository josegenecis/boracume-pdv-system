import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

interface Waiter {
  id: string;
  name: string;
  active: boolean;
}

export default function OperatorSwitcher() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [operatorId, setOperatorId] = useState<string>('');
  const [operatorName, setOperatorName] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', pin: '' });
  const [loading, setLoading] = useState(false);

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
        setWaiters(((data as any) || []).filter((w: any) => w.active));
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
  
  const addOperator = async () => {
    if (!form.name.trim() || !form.pin.trim()) {
      toast({ title: 'Campos obrigatórios', description: 'Informe nome e PIN', variant: 'destructive' });
      return;
    }
    if (form.pin.length < 4) {
      toast({ title: 'PIN inválido', description: 'O PIN deve ter pelo menos 4 dígitos', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('waiters' as any)
        .insert({ user_id: user?.id, name: form.name.trim(), pin: form.pin.trim(), active: true })
        .select('id, name')
        .single();
      if (error) throw error;
      const created: any = data;
      toast({ title: 'Operador criado!', description: `${created.name} adicionado` });
      setWaiters(prev => [...prev, { id: created.id, name: created.name, active: true }]);
      // Seleciona automaticamente
      handleChange(created.id);
      setForm({ name: '', pin: '' });
      setShowCreate(false);
    } catch (e: any) {
      toast({ title: 'Erro ao criar operador', description: e?.message || 'Verifique tabelas/RLS no Supabase', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8" title="Criar operador">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Operador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: João Silva" />
            </div>
            <div className="space-y-2">
              <Label>PIN (4-6 dígitos)</Label>
              <Input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} maxLength={6} placeholder="Ex: 1234" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={addOperator} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Button variant="outline" size="sm" onClick={() => window.open(`${window.location.origin}/garcons`, '_blank')} className="h-8">
        Gerenciar
      </Button>
    </div>
  );
}
