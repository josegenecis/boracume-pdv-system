import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Link as LinkIcon, Trash2, Key, Copy, Eye, EyeOff, ExternalLink, Shield, Settings } from 'lucide-react';

interface Waiter {
  id: string;
  name: string;
  pin: string;
  active: boolean;
  role?: 'admin' | 'cashier' | string;
  permissions?: {
    pos_access?: boolean;
    pos_open_close?: boolean;
    pos_discount?: boolean;
    orders_manage?: boolean;
    menu_manage?: boolean;
    financial_view?: boolean;
    settings_manage?: boolean;
    users_manage?: boolean;
    [key: string]: boolean | undefined;
  };
}

const PERMISSIONS_LIST = [
  { id: 'pos_access', label: 'Acesso ao PDV', description: 'Pode acessar a tela de vendas' },
  { id: 'pos_open_close', label: 'Abrir/Fechar Caixa', description: 'Pode abrir e fechar o turno' },
  { id: 'pos_discount', label: 'Dar Descontos', description: 'Pode aplicar descontos no PDV' },
  { id: 'orders_manage', label: 'Gerenciar Pedidos', description: 'Aceitar, cancelar e alterar status' },
  { id: 'menu_manage', label: 'Gerenciar Cardápio', description: 'Criar/Editar produtos e categorias' },
  { id: 'financial_view', label: 'Ver Financeiro', description: 'Acesso a relatórios de vendas' },
  { id: 'settings_manage', label: 'Configurações', description: 'Acesso às configurações gerais' },
  { id: 'users_manage', label: 'Gerenciar Equipe', description: 'Criar e editar outros usuários' },
];

const Garcons = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [form, setForm] = useState({ name: '', pin: '', role: 'cashier' as 'admin' | 'cashier' });
  const [loading, setLoading] = useState(false);
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});
  
  // State for Permissions Modal
  const [selectedWaiter, setSelectedWaiter] = useState<Waiter | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) loadWaiters();
  }, [user]);

  const loadWaiters = async () => {
    try {
      const { data, error } = await (supabase as any)
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
      const defaultPermissions = form.role === 'admin' 
        ? PERMISSIONS_LIST.reduce((acc, curr) => ({ ...acc, [curr.id]: true }), {})
        : { pos_access: true }; // Default for cashier

      const payload: any = {
        user_id: user?.id,
        name: form.name.trim(),
        pin: form.pin.trim(),
        active: true,
        role: form.role,
        permissions: defaultPermissions,
      };

      const res1 = await (supabase as any).from('waiters').insert(payload);
      let error: any = (res1 as any).error;
      if (error && String(error.message || '').includes('role')) {
        const { role, permissions, ...fallback } = payload;
        const res2 = await (supabase as any).from('waiters').insert(fallback);
        error = (res2 as any).error;
      }
      if (error) throw error;

      setForm({ name: '', pin: '', role: 'cashier' });
      loadWaiters();
      
      const link = `${window.location.origin}/waiter-login`;
      
      toast({ 
        title: 'Usuário cadastrado!', 
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

  const updateWaiter = async (id: string, patch: Partial<Waiter>) => {
    try {
      const payload: any = { ...patch };
      const res1 = await (supabase as any).from('waiters').update(payload).eq('id', id);
      const error: any = (res1 as any).error;
      if (error) throw error;
      loadWaiters();
      toast({ title: 'Atualizado com sucesso' });
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar', description: e?.message, variant: 'destructive' });
    }
  };

  const removeWaiter = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('waiters').delete().eq('id', id);
      if (error) throw error;
      loadWaiters();
      toast({ title: 'Usuário removido' });
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
    toast({ title: 'Link copiado!', description: 'Envie este link para a equipe acessar o sistema.' });
  };

  const openPermissionsModal = (waiter: Waiter) => {
    setSelectedWaiter(waiter);
    setEditingPermissions(waiter.permissions || {});
    setIsPermissionsOpen(true);
  };

  const savePermissions = async () => {
    if (!selectedWaiter) return;
    
    await updateWaiter(selectedWaiter.id, { permissions: editingPermissions });
    setIsPermissionsOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> 
            Novo Usuário
          </CardTitle>
          <CardDescription>
            Crie usuários para acessar o sistema (Garçons, Caixas, Gerentes).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="name">Nome</Label>
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
            <div>
              <Label>Perfil Inicial</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Operador (Básico)</SelectItem>
                  <SelectItem value="admin">Administrador (Total)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={addWaiter} disabled={loading || !form.name.trim() || !form.pin.trim()} className="w-full">
                <Key className="mr-2 h-4 w-4" />
                Criar Usuário
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gerenciar Equipe</CardTitle>
            <CardDescription>Configure permissões detalhadas para cada usuário</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open(`${window.location.origin}/waiter-login`, '_blank')}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Testar Acesso
            </Button>
            <Button variant="outline" onClick={copyLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {waiters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
              Nenhum usuário cadastrado. Adicione alguém acima para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Permissões</TableHead>
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
                      <Select
                        value={(w.role as any) || 'cashier'}
                        onValueChange={(v) => updateWaiter(w.id, { 
                          role: v as any, 
                          permissions: v === 'admin' 
                            ? PERMISSIONS_LIST.reduce((acc, curr) => ({ ...acc, [curr.id]: true }), {}) 
                            : { pos_access: true }
                        })}
                      >
                        <SelectTrigger className="h-8 w-[160px]">
                          <SelectValue placeholder="Perfil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cashier">Operador</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {w.role === 'admin' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                            Acesso Total
                          </span>
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {Object.entries(w.permissions || {}).filter(([_, v]) => v).slice(0, 3).map(([k]) => (
                               <span key={k} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border">
                                 {PERMISSIONS_LIST.find(p => p.id === k)?.label || k}
                               </span>
                            ))}
                            {Object.values(w.permissions || {}).filter(v => v).length > 3 && (
                               <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-500 border">
                                 +{Object.values(w.permissions || {}).filter(v => v).length - 3}
                               </span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={w.active}
                        onCheckedChange={(checked) => updateWaiter(w.id, { active: checked })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPermissionsModal(w)}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Permissões
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeWaiter(w.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Permissões de Acesso</DialogTitle>
            <DialogDescription>
              Configurando acesso para: <strong>{selectedWaiter?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {selectedWaiter?.role === 'admin' && (
               <div className="mb-4 bg-yellow-50 p-3 rounded-md border border-yellow-200 text-yellow-800 text-sm">
                 Este usuário é <strong>Administrador</strong> e tem acesso total. Mude o perfil para "Operador" se quiser restringir acessos.
               </div>
            )}
            
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${selectedWaiter?.role === 'admin' ? 'opacity-50 pointer-events-none' : ''}`}>
              {PERMISSIONS_LIST.map((permission) => (
                <div key={permission.id} className="flex items-start space-x-3 space-y-0 rounded-md border p-3 hover:bg-accent">
                  <Checkbox
                    id={permission.id}
                    checked={editingPermissions[permission.id] === true}
                    onCheckedChange={(checked) => {
                      setEditingPermissions(prev => ({
                        ...prev,
                        [permission.id]: checked === true
                      }));
                    }}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor={permission.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {permission.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {permission.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermissionsOpen(false)}>Cancelar</Button>
            <Button onClick={savePermissions}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Garcons;
