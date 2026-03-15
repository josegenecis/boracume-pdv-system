
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Define delivery personnel type
interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  status: 'available' | 'busy' | 'offline';
}

// Define form schema
const deliveryPersonSchema = z.object({
  name: z.string().min(3, { message: 'Nome deve ter pelo menos 3 caracteres' }),
  phone: z.string().min(8, { message: 'Telefone inválido' }),
  vehicle_type: z.string().min(1, { message: 'Tipo de veículo é obrigatório' }),
  vehicle_plate: z.string().optional(),
  status: z.enum(['available', 'busy', 'offline']),
});

type DeliveryPersonFormValues = z.infer<typeof deliveryPersonSchema>;

const Entregadores: React.FC = () => {
  const [deliveryPersonnel, setDeliveryPersonnel] = useState<DeliveryPerson[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentDeliveryPerson, setCurrentDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [requireDriver, setRequireDriver] = useState(false);
  const [payoutMode, setPayoutMode] = useState<'delivery_fee' | 'fixed'>('delivery_fee');
  const [fixedPayoutRaw, setFixedPayoutRaw] = useState('0');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementRows, setSettlementRows] = useState<Array<{ driverId: string; driverName: string; orderCount: number; total: number; orderIds: string[] }>>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirmDialog();
  
  // Initialize form
  const form = useForm<DeliveryPersonFormValues>({
    resolver: zodResolver(deliveryPersonSchema),
    defaultValues: {
      name: '',
      phone: '',
      vehicle_type: '',
      vehicle_plate: '',
      status: 'available',
    },
  });
  
  // Fetch delivery personnel
  const fetchDeliveryPersonnel = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('delivery_personnel')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      
      setDeliveryPersonnel(data as DeliveryPerson[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar entregadores',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchDeliveryPersonnel();
  }, [user, toast]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setSettingsLoading(true);
      try {
        const settingsRes = await supabase
          .from('delivery_settlement_settings' as any)
          .select('require_driver,payout_mode,fixed_payout')
          .eq('user_id', user.id)
          .maybeSingle();

        const settings = (settingsRes as any)?.data;
        const err = (settingsRes as any)?.error;
        if (err) throw err;

        if (settings) {
          setRequireDriver(Boolean(settings.require_driver));
          setPayoutMode(settings.payout_mode === 'fixed' ? 'fixed' : 'delivery_fee');
          setFixedPayoutRaw(String(Math.max(0, Number(settings.fixed_payout) || 0)));
        } else {
          await supabase.from('delivery_settlement_settings' as any).insert({
            user_id: user.id,
            require_driver: false,
            payout_mode: 'delivery_fee',
            fixed_payout: 0
          });
          setRequireDriver(false);
          setPayoutMode('delivery_fee');
          setFixedPayoutRaw('0');
        }
      } catch {
        const fromStorage = (() => {
          try {
            return JSON.parse(localStorage.getItem('boracume_delivery_settings') || '{}');
          } catch {
            return {};
          }
        })();
        setRequireDriver(Boolean(fromStorage?.require_driver));
        setPayoutMode(fromStorage?.payout_mode === 'fixed' ? 'fixed' : 'delivery_fee');
        setFixedPayoutRaw(String(Math.max(0, Number(fromStorage?.fixed_payout) || 0)));
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, [user?.id]);

  const saveSettings = async (next: { require_driver: boolean; payout_mode: 'delivery_fee' | 'fixed'; fixed_payout: number }) => {
    if (!user?.id) return;
    setSettingsLoading(true);
    try {
      await supabase
        .from('delivery_settlement_settings' as any)
        .upsert({
          user_id: user.id,
          require_driver: next.require_driver,
          payout_mode: next.payout_mode,
          fixed_payout: next.fixed_payout,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch {
      try {
        localStorage.setItem('boracume_delivery_settings', JSON.stringify(next));
      } catch {}
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadSettlementReport = async () => {
    if (!user?.id) return;
    setSettlementLoading(true);
    try {
      const start = new Date(`${reportDate}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data, error } = await supabase
        .from('orders' as any)
        .select('id,delivery_personnel_id,delivery_payout_amount,delivery_fee,created_at,status,delivery_settled')
        .eq('user_id', user.id)
        .eq('status', 'delivered')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString());

      if (error) throw error;

      const nameById = new Map(deliveryPersonnel.map(p => [p.id, p.name]));
      const rowsByDriver = new Map<string, { driverId: string; driverName: string; orderCount: number; total: number; orderIds: string[] }>();

      ((data as any[]) || []).forEach(o => {
        if (o?.delivery_settled) return;
        const driverId = String(o?.delivery_personnel_id || '');
        if (!driverId) return;
        const driverName = nameById.get(driverId) || 'Motoboy';
        const payout =
          o?.delivery_payout_amount !== null && o?.delivery_payout_amount !== undefined
            ? Math.max(0, Number(o.delivery_payout_amount) || 0)
            : payoutMode === 'fixed'
              ? Math.max(0, Number(fixedPayoutRaw) || 0)
              : Math.max(0, Number(o?.delivery_fee) || 0);

        const current = rowsByDriver.get(driverId) || { driverId, driverName, orderCount: 0, total: 0, orderIds: [] };
        current.orderCount += 1;
        current.total += payout;
        current.orderIds.push(String(o.id));
        rowsByDriver.set(driverId, current);
      });

      const rows = Array.from(rowsByDriver.values()).sort((a, b) => b.total - a.total);
      setSettlementRows(rows);
    } catch (e: any) {
      setSettlementRows([]);
      toast({
        title: 'Erro',
        description: e?.message || 'Não foi possível gerar o acerto de contas.',
        variant: 'destructive'
      });
    } finally {
      setSettlementLoading(false);
    }
  };

  useEffect(() => {
    loadSettlementReport();
  }, [user?.id, reportDate, payoutMode, fixedPayoutRaw, deliveryPersonnel.length]);

  const settleDriver = async (driverId: string) => {
    if (!user?.id) return;
    const row = settlementRows.find(r => r.driverId === driverId);
    if (!row || row.orderIds.length === 0) return;
    const ok = await confirm({
      title: 'Marcar como pago',
      description: `Marcar ${row.orderCount} entrega(s) de ${row.driverName} como paga(s)?`,
      confirmText: 'Marcar',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      setSettlementLoading(true);
      const { error } = await supabase
        .from('orders' as any)
        .update({ delivery_settled: true, delivery_settled_at: new Date().toISOString() } as any)
        .in('id', row.orderIds)
        .eq('user_id', user.id);
      if (error) throw error;
      await loadSettlementReport();
      toast({ title: 'Pago', description: 'Acerto marcado como pago.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Não foi possível marcar como pago.', variant: 'destructive' });
    } finally {
      setSettlementLoading(false);
    }
  };
  
  // Handle form submission
  const onSubmit = async (data: DeliveryPersonFormValues) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      if (currentDeliveryPerson) {
        // Update existing delivery person
        const { error } = await supabase
          .from('delivery_personnel')
          .update({
            name: data.name,
            phone: data.phone,
            vehicle_type: data.vehicle_type,
            vehicle_plate: data.vehicle_plate || null,
            status: data.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentDeliveryPerson.id);
        
        if (error) throw error;
        
        toast({
          title: 'Entregador atualizado',
          description: 'As informações do entregador foram atualizadas com sucesso.',
        });
      } else {
        // Create new delivery person
        const { error } = await supabase
          .from('delivery_personnel')
          .insert({
            user_id: user.id,
            name: data.name,
            phone: data.phone,
            vehicle_type: data.vehicle_type,
            vehicle_plate: data.vehicle_plate || null,
            status: data.status,
          });
        
        if (error) throw error;
        
        toast({
          title: 'Entregador adicionado',
          description: 'O entregador foi adicionado com sucesso.',
        });
      }
      
      // Refresh list and reset form
      await fetchDeliveryPersonnel();
      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar entregador',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete delivery person
  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir entregador',
      description: 'Tem certeza que deseja excluir este entregador?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('delivery_personnel')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Entregador excluído',
        description: 'O entregador foi removido com sucesso.',
      });
      
      await fetchDeliveryPersonnel();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir entregador',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Edit delivery person
  const handleEdit = (deliveryPerson: DeliveryPerson) => {
    setCurrentDeliveryPerson(deliveryPerson);
    
    form.setValue('name', deliveryPerson.name);
    form.setValue('phone', deliveryPerson.phone);
    form.setValue('vehicle_type', deliveryPerson.vehicle_type);
    form.setValue('vehicle_plate', deliveryPerson.vehicle_plate || '');
    form.setValue('status', deliveryPerson.status);
    
    setIsDialogOpen(true);
  };
  
  // Open dialog for new delivery person
  const handleAddNew = () => {
    resetForm();
    setCurrentDeliveryPerson(null);
    setIsDialogOpen(true);
  };
  
  // Reset form
  const resetForm = () => {
    form.reset({
      name: '',
      phone: '',
      vehicle_type: '',
      vehicle_plate: '',
      status: 'available',
    });
  };
  
  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };
  
  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return 'Disponível';
      case 'busy':
        return 'Em Entrega';
      case 'offline':
        return 'Offline';
      default:
        return status;
    }
  };

  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  const settlementByDriverId = new Map(settlementRows.map(r => [r.driverId, r]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Entregadores</h1>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" /> Novo Entregador
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acerto de contas</CardTitle>
          <CardDescription>
            Defina regras de motoboy e veja quanto pagar por dia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium">Exigir motoboy ao sair para entrega</div>
              <div className="text-sm text-muted-foreground">
                Ao marcar “Saiu para entrega”, obriga selecionar um entregador
              </div>
            </div>
            <Switch
              checked={requireDriver}
              disabled={settingsLoading}
              onCheckedChange={(checked) => {
                setRequireDriver(checked);
                const next = {
                  require_driver: checked,
                  payout_mode: payoutMode,
                  fixed_payout: Math.max(0, Number(fixedPayoutRaw) || 0)
                };
                saveSettings(next);
              }}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Base do pagamento</Label>
              <Select
                value={payoutMode}
                onValueChange={(value) => {
                  const mode = value === 'fixed' ? 'fixed' : 'delivery_fee';
                  setPayoutMode(mode);
                  const next = {
                    require_driver: requireDriver,
                    payout_mode: mode,
                    fixed_payout: Math.max(0, Number(fixedPayoutRaw) || 0)
                  };
                  saveSettings(next);
                }}
                disabled={settingsLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery_fee">Taxa de entrega</SelectItem>
                  <SelectItem value="fixed">Valor fixo por entrega</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor fixo (R$)</Label>
              <Input
                inputMode="decimal"
                value={fixedPayoutRaw}
                disabled={settingsLoading || payoutMode !== 'fixed'}
                onChange={(e) => setFixedPayoutRaw(e.target.value.replace(/[^\d,.-]/g, ''))}
                onBlur={() => {
                  const next = {
                    require_driver: requireDriver,
                    payout_mode: payoutMode,
                    fixed_payout: Math.max(0, Number(String(fixedPayoutRaw || '').replace(',', '.')) || 0)
                  };
                  setFixedPayoutRaw(String(next.fixed_payout));
                  saveSettings(next);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Dia</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </div>
          </div>

          {settlementLoading ? (
            <div className="py-6 text-center text-muted-foreground">Carregando acerto...</div>
          ) : settlementRows.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              Nenhuma entrega para acertar neste dia
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Motoboy</TableHead>
                    <TableHead>Entregas</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlementRows.map((row) => (
                    <TableRow key={row.driverId}>
                      <TableCell className="font-medium">{row.driverName}</TableCell>
                      <TableCell>{row.orderCount}</TableCell>
                      <TableCell className="font-semibold">{formatBRL(row.total)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={settlementLoading}
                          onClick={() => settleDriver(row.driverId)}
                        >
                          Marcar como pago
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Entregadores</CardTitle>
          <CardDescription>
            Gerencie a equipe de entregadores do seu restaurante
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando entregadores...
            </div>
          ) : deliveryPersonnel.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum entregador cadastrado. Clique em "Novo Entregador" para adicionar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entregas (dia)</TableHead>
                  <TableHead>Saldo (dia)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryPersonnel.map((deliveryPerson) => (
                  <TableRow key={deliveryPerson.id}>
                    <TableCell className="font-medium">{deliveryPerson.name}</TableCell>
                    <TableCell>{deliveryPerson.phone}</TableCell>
                    <TableCell>{deliveryPerson.vehicle_type}</TableCell>
                    <TableCell>{deliveryPerson.vehicle_plate || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(deliveryPerson.status)}>
                        {getStatusLabel(deliveryPerson.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{settlementByDriverId.get(deliveryPerson.id)?.orderCount || 0}</TableCell>
                    <TableCell className="font-semibold">{formatBRL(settlementByDriverId.get(deliveryPerson.id)?.total || 0)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(deliveryPerson)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-500 hover:text-red-500"
                          onClick={() => handleDelete(deliveryPerson.id)}
                        >
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
      
      {/* Dialog for adding/editing delivery personnel */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {currentDeliveryPerson ? 'Editar Entregador' : 'Novo Entregador'}
            </DialogTitle>
            <DialogDescription>
              {currentDeliveryPerson
                ? 'Edite as informações do entregador abaixo.'
                : 'Preencha as informações do novo entregador.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do entregador" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="vehicle_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Veículo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo de veículo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Moto">Moto</SelectItem>
                        <SelectItem value="Carro">Carro</SelectItem>
                        <SelectItem value="Bicicleta">Bicicleta</SelectItem>
                        <SelectItem value="A pé">A pé</SelectItem>
                        <SelectItem value="Van">Van</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="vehicle_plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placa do Veículo (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC-1234" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Disponível</SelectItem>
                        <SelectItem value="busy">Em Entrega</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading
                    ? 'Salvando...'
                    : currentDeliveryPerson
                    ? 'Salvar Alterações'
                    : 'Adicionar Entregador'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Entregadores;
