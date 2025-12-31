import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Link as LinkIcon, Trash2, Key, Copy, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface Waiter {
  id: string;
  name: string;
  pin: string;
  active: boolean;
}

const Garcons = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [form, setForm] = useState({ name: '', pin: '' });
  const [loading, setLoading] = useState(false);
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});

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
      console.warn('Erro ao carregar garçons:', e?.message);
    }
  };

  const addWaiter = async () => {
    if (!form.name.trim() || !form.pin.trim()) return;
    
    if (form.pin.length < 4) {
      toast({ title: 'PIN inválido', description: 'O PIN deve ter pelo menos 4 dígitos', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('waiters')
        .insert({ 
          user_id: user?.id, 
          name: form.name.trim(), 
          pin: form.pin.trim(), 
          active: true 
        });

      if (error) throw error;
      setForm({ name: '', pin: '' });
      loadWaiters();
      
      const link = `${window.location.origin}/waiter-login`;
      
      // Criar a conta de autenticação se não existir (opcional, dependendo de como o auth é tratado)
      // Aqui estamos apenas criando o registro na tabela waiters

      toast({ 
        title: 'Garçom cadastrado!', 
        description: `Link de acesso: ${link}`,
        action: (
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(link)}>
                Copiar
            </Button>
        ),
        duration: 8000
      });
    } catch (e: any) {
      toast({ title: 'Erro ao cadastrar', description: e?.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const removeWaiter = async (id: string) => {
    try {
      const { error } = await supabase.from('waiters').delete().eq('id', id);
      if (error) throw error;
      loadWaiters();
      toast({ title: 'Garçom removido' });
    } catch (e) {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  const togglePinVisibility = (id: string) => {
    setShowPins(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyLink = async () => {
    const link = `${window.location.origin}/waiter-login`;
    await navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!', description: 'Envie este link para os garçons acessarem o sistema.' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> 
            Cadastrar Garçom
          </CardTitle>
          <CardDescription>
            Crie um login para seus garçons lançarem pedidos nas mesas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="name">Nome do Garçom</Label>
              <Input 
                id="name"
                placeholder="Ex: João Silva"
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
              />
            </div>
            <div>
              <Label htmlFor="pin">PIN de Acesso (4-6 dígitos)</Label>
              <Input 
                id="pin"
                type="text" 
                maxLength={6}
                placeholder="Ex: 1234"
                value={form.pin} 
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} 
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addWaiter} disabled={loading || !form.name.trim() || !form.pin.trim()} className="w-full">
                <Key className="mr-2 h-4 w-4" />
                Criar Acesso
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Equipe de Garçons</CardTitle>
            <CardDescription>Gerencie o acesso da sua equipe</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open(`${window.location.origin}/waiter-login`, '_blank')}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Testar Link
            </Button>
            <Button variant="outline" onClick={copyLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar Link de Acesso
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {waiters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
              Nenhum garçom cadastrado. Adicione alguém acima para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>PIN de Acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waiters.map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                          {showPins[w.id] ? w.pin : '••••'}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePinVisibility(w.id)}>
                          {showPins[w.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${w.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {w.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeWaiter(w.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
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
