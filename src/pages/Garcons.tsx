import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Link as LinkIcon, Trash2 } from 'lucide-react';

interface Waiter {
  id: string;
  name: string;
  phone?: string;
  active: boolean;
}

const Garcons = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) loadWaiters();
  }, [user]);

  const loadWaiters = async () => {
    try {
      const { data, error } = await supabase
        .from('waiters')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');
      if (error) throw error;
      setWaiters(data || []);
    } catch (e: any) {
      console.warn('waiters table missing or not accessible', e?.message);
      setWaiters([]);
    }
  };

  const addWaiter = async () => {
    if (!form.name.trim()) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('waiters')
        .insert({ user_id: user?.id, name: form.name.trim(), phone: form.phone || null, active: true });
      if (error) throw error;
      setForm({ name: '', phone: '' });
      loadWaiters();
      toast({ title: 'Garçom cadastrado' });
    } catch (e: any) {
      toast({ title: 'Erro ao cadastrar garçom', description: e?.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const removeWaiter = async (id: string) => {
    try {
      const { error } = await supabase.from('waiters').delete().eq('id', id);
      if (error) throw error;
      loadWaiters();
    } catch (e) {}
  };

  const getWaiterLink = (id: string) => `${window.location.origin}/pdv?mode=waiter&waiterId=${id}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Cadastrar Garçom</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Telefone (opcional)</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button onClick={addWaiter} disabled={loading || !form.name.trim()} className="w-full">Salvar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Garçons</CardTitle>
        </CardHeader>
        <CardContent>
          {waiters.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum garçom cadastrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Link de Pedido</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waiters.map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>{w.phone || '-'}</TableCell>
                    <TableCell>
                      <a href={getWaiterLink(w.id)} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">
                        <LinkIcon className="h-4 w-4" /> Abrir
                      </a>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => removeWaiter(w.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Garcons;
