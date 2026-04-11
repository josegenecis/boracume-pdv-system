import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Trash2, Key, Shield, Eye, EyeOff, Check, User, Lock, Mail, CreditCard, Box, FileText, Settings, BadgePercent } from 'lucide-react';

interface Waiter {
  id: string;
  name: string;
  email?: string;
  cpf?: string;
  password?: string;
  pin: string;
  active: boolean;
  role: 'admin' | 'cashier';
  permissions: Record<string, boolean>;
}

const PERMISSIONS_GROUPS = [
  {
    id: 'sales',
    label: 'Vendas e PDV',
    icon: <CreditCard className="w-4 h-4" />,
    permissions: [
      { id: 'pos_access', label: 'Acessar PDV', description: 'Pode entrar na tela de vendas' },
      { id: 'pos_discount', label: 'Aplicar Descontos', description: 'Pode dar descontos manuais' },
      { id: 'pos_cancel_item', label: 'Cancelar Itens', description: 'Pode remover itens do pedido' },
    ]
  },
  {
    id: 'cashier',
    label: 'Caixa',
    icon: <Lock className="w-4 h-4" />,
    permissions: [
      { id: 'pos_open_close', label: 'Abrir/Fechar Caixa', description: 'Gestão de turnos' },
      { id: 'cash_movement', label: 'Sangria/Suprimento', description: 'Movimentar dinheiro do caixa' },
    ]
  },
  {
    id: 'management',
    label: 'Gestão',
    icon: <Box className="w-4 h-4" />,
    permissions: [
      { id: 'orders_manage', label: 'Gerenciar Pedidos', description: 'Ver e editar pedidos ativos' },
      { id: 'menu_manage', label: 'Gerenciar Cardápio', description: 'Criar/Editar produtos' },
      { id: 'stock_manage', label: 'Gerenciar Estoque', description: 'Ajustar quantidades' },
    ]
  },
  {
    id: 'admin',
    label: 'Administrativo',
    icon: <Settings className="w-4 h-4" />,
    permissions: [
      { id: 'financial_view', label: 'Ver Financeiro', description: 'Relatórios de faturamento' },
      { id: 'users_manage', label: 'Gerenciar Equipe', description: 'Criar e editar usuários' },
      { id: 'settings_manage', label: 'Configurações', description: 'Configurações do sistema' },
    ]
  }
];

const Garcons = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirmDialog();
  
  // Data State
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'permissions'>('data');
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Waiter>>({
    name: '',
    email: '',
    cpf: '',
    password: '',
    pin: '',
    role: 'cashier',
    active: true,
    permissions: {}
  });

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
      setWaiters((data as any) || []);
    } catch (e: any) {
      console.error('Erro ao carregar:', e);
    }
  };

  const handleOpenDialog = (waiter?: Waiter) => {
    if (waiter) {
      setFormData({ ...waiter, password: '' }); // Don't show existing password
    } else {
      setFormData({
        name: '',
        email: '',
        cpf: '',
        password: '',
        pin: '',
        role: 'cashier',
        active: true,
        permissions: { pos_access: true }
      });
    }
    setActiveTab('data');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const normalizedCpf = String(formData.cpf || '').replace(/\D/g, '');
    if (!formData.name?.trim() || !formData.pin?.trim() || normalizedCpf.length !== 11) {
      toast({ title: 'Campos obrigatórios', description: 'Nome, PIN e CPF válido são obrigatórios.', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      
      // If admin, grant all permissions
      const permissions = formData.role === 'admin' 
        ? PERMISSIONS_GROUPS.flatMap(g => g.permissions).reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
        : formData.permissions;

      const payload = {
        user_id: user?.id,
        name: formData.name,
        email: formData.email,
        cpf: normalizedCpf,
        pin: formData.pin,
        role: formData.role,
        active: formData.active,
        permissions,
        // Only include password if it was typed (for edits) or is new
        ...(formData.password ? { password: formData.password } : {})
      };

      let error;
      if (formData.id) {
        const { error: updateError } = await supabase
          .from('waiters')
          .update(payload)
          .eq('id', formData.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('waiters')
          .insert(payload);
        error = insertError;
      }

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Usuário salvo com sucesso.' });
      setIsDialogOpen(false);
      loadWaiters();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Remover usuário',
      description: 'Tem certeza que deseja remover este usuário?',
      confirmText: 'Remover',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    
    try {
      const { error } = await supabase.from('waiters').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Usuário removido' });
      loadWaiters();
    } catch (e: any) {
      toast({ title: 'Erro ao remover', description: e.message, variant: 'destructive' });
    }
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permId]: !prev.permissions?.[permId]
      }
    }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Gerenciar Equipe</h1>
          <p className="text-muted-foreground mt-1">Controle de acesso, usuários e permissões do sistema.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90">
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waiters.map((waiter) => (
                <TableRow key={waiter.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {waiter.name.charAt(0).toUpperCase()}
                      </div>
                      {waiter.name}
                    </div>
                  </TableCell>
                  <TableCell>{waiter.email || '-'}</TableCell>
                  <TableCell>{waiter.cpf ? waiter.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      waiter.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {waiter.role === 'admin' ? 'Administrador' : 'Operador'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      waiter.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${waiter.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {waiter.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(waiter)}>
                        <Settings className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(waiter.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {waiters.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formData.id ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para {formData.id ? 'editar' : 'criar'} o acesso.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <div className="flex border-b mb-6">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'data' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('data')}
              >
                Dados Pessoais
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'permissions' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('permissions')}
              >
                Permissões de Acesso
              </button>
            </div>

            {activeTab === 'data' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="name" 
                        className="pl-9" 
                        placeholder="Ex: João Silva"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (Opcional)</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="email" 
                        className="pl-9" 
                        placeholder="joao@email.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF para Login Web</Label>
                      <Input
                        id="cpf"
                        placeholder="000.000.000-00"
                        value={String(formData.cpf || '')
                          .replace(/\D/g, '')
                          .slice(0, 11)
                          .replace(/^(\d{3})(\d)/, '$1.$2')
                          .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
                          .replace(/\.(\d{3})(\d)/, '.$1-$2')}
                        onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pin">PIN de Acesso (PDV) *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="pin" 
                        type={showPin ? "text" : "password"}
                        className="pl-9 pr-9" 
                        placeholder="Ex: 1234"
                        maxLength={6}
                        value={formData.pin}
                        onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-gray-700"
                      >
                        {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha (Login Web)</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="password" 
                        type={showPassword ? "text" : "password"}
                        className="pl-9 pr-9" 
                        placeholder={formData.id ? "Deixe em branco para manter" : "Senha segura"}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>Perfil de Acesso</Label>
                    <Select 
                      value={formData.role} 
                      onValueChange={(v: any) => setFormData({ ...formData, role: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cashier">Operador (Básico)</SelectItem>
                        <SelectItem value="admin">Administrador (Total)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Administradores têm acesso irrestrito a todas as funções.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Status da Conta</Label>
                    <div className="flex items-center space-x-2 border p-2 rounded-md">
                      <Switch 
                        checked={formData.active}
                        onCheckedChange={(c) => setFormData({ ...formData, active: c })}
                      />
                      <span className="text-sm font-medium">
                        {formData.active ? 'Ativo - Pode acessar' : 'Inativo - Acesso bloqueado'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 h-[400px] overflow-y-auto pr-2">
                {formData.role === 'admin' && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-md flex items-start gap-3">
                    <Shield className="w-5 h-5 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">Acesso de Administrador</h4>
                      <p className="text-sm mt-1">
                        Usuários com perfil Administrador possuem todas as permissões habilitadas automaticamente. 
                        Para personalizar, altere o perfil para "Operador".
                      </p>
                    </div>
                  </div>
                )}

                <div className={formData.role === 'admin' ? 'opacity-50 pointer-events-none grayscale' : ''}>
                  {PERMISSIONS_GROUPS.map((group) => (
                    <div key={group.id} className="mb-6">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                        <div className="p-1.5 bg-primary/10 rounded-md text-primary">
                          {group.icon}
                        </div>
                        <h3 className="font-semibold text-gray-900">{group.label}</h3>
                      </div>
                      <div className="space-y-3">
                        {group.permissions.map((perm) => (
                          <div key={perm.id} className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
                            <div className="space-y-0.5">
                              <Label htmlFor={perm.id} className="text-base font-medium cursor-pointer">
                                {perm.label}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {perm.description}
                              </p>
                            </div>
                            <Switch
                              id={perm.id}
                              checked={formData.permissions?.[perm.id] === true}
                              onCheckedChange={() => togglePermission(perm.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading} className="min-w-[120px]">
              {loading ? 'Salvando...' : 'Salvar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Garcons;
