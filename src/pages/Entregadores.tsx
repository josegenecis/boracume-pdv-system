
import React, { useState, useEffect, useMemo } from 'react';
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
import { Banknote, Copy, ExternalLink, History, KeyRound, Plus, Smartphone, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { formatMotoboyCpf, isValidMotoboyCpf, normalizeMotoboyCpf } from "@/services/motoboyWebClient";
import { useNavigate } from 'react-router-dom';

// Define delivery personnel type
interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  status: 'available' | 'busy' | 'offline';
  app_enabled?: boolean;
  app_login?: string | null;
  cpf?: string | null;
  daily_allowance?: number;
}

interface DeliveryHistoryRow {
  id: string;
  orderNumber: string;
  driverId: string;
  driverName: string;
  customerName: string;
  status: string;
  assignedAt: string;
  payout: number;
  settled: boolean;
  settledAt: string | null;
}

const toLocalDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const historyInitialStart = () => {
  const date = new Date();
  date.setDate(1);
  return toLocalDateInput(date);
};

// Define form schema
const deliveryPersonSchema = z.object({
  name: z.string().min(3, { message: 'Nome deve ter pelo menos 3 caracteres' }),
  phone: z.string().min(8, { message: 'Telefone inválido' }),
  vehicle_type: z.string().min(1, { message: 'Tipo de veículo é obrigatório' }),
  vehicle_plate: z.string().optional(),
  status: z.enum(['available', 'busy', 'offline']),
  app_enabled: z.boolean().default(false),
  cpf: z.string().optional(),
  app_password: z.string().optional(),
  daily_allowance: z.coerce.number().min(0, { message: 'A ajuda de custo não pode ser negativa' }).default(0),
});

type DeliveryPersonFormValues = z.infer<typeof deliveryPersonSchema>;

const Entregadores: React.FC = () => {
  const navigate = useNavigate();
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
  const [settlementRows, setSettlementRows] = useState<Array<{
    driverId: string;
    driverName: string;
    orderCount: number;
    deliveryTotal: number;
    allowance: number;
    total: number;
    orderIds: string[];
  }>>([]);
  const [historyStart, setHistoryStart] = useState(historyInitialStart);
  const [historyEnd, setHistoryEnd] = useState(() => toLocalDateInput(new Date()));
  const [historyDriverId, setHistoryDriverId] = useState('all');
  const [historyPaymentStatus, setHistoryPaymentStatus] = useState<'all' | 'pending' | 'paid'>('all');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<DeliveryHistoryRow[]>([]);
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
      app_enabled: false,
      cpf: '',
      app_password: '',
      daily_allowance: 0,
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

      const primary = await supabase
        .from('orders' as any)
        .select('id,delivery_personnel_id,delivery_payout_amount,delivery_fee,created_at,delivery_assigned_at,status,delivery_settled')
        .eq('user_id', user.id)
        .in('status', ['in_delivery', 'delivered', 'completed'])
        .gte('delivery_assigned_at', start.toISOString())
        .lt('delivery_assigned_at', end.toISOString());

      const fallback = primary.error || ((primary.data as any[]) || []).length === 0
        ? await supabase
            .from('orders' as any)
            .select('id,delivery_personnel_id,delivery_payout_amount,delivery_fee,created_at,delivery_assigned_at,status,delivery_settled')
            .eq('user_id', user.id)
            .in('status', ['in_delivery', 'delivered', 'completed'])
            .gte('created_at', start.toISOString())
            .lt('created_at', end.toISOString())
        : null;

      const data = (fallback ? (fallback as any).data : primary.data) as any[];
      const error = fallback ? (fallback as any).error : primary.error;

      if (error) throw error;

      const personnelById = new Map(deliveryPersonnel.map((person) => [person.id, person]));
      const rowsByDriver = new Map<string, {
        driverId: string;
        driverName: string;
        orderCount: number;
        deliveryTotal: number;
        allowance: number;
        total: number;
        orderIds: string[];
      }>();

      ((data as any[]) || []).forEach(o => {
        if (o?.delivery_settled) return;
        const driverId = String(o?.delivery_personnel_id || '');
        if (!driverId) return;
        const driver = personnelById.get(driverId);
        const driverName = driver?.name || 'Motoboy';
        const status = String(o?.status || '');
        const payout =
          o?.delivery_payout_amount !== null && o?.delivery_payout_amount !== undefined
            ? Math.max(0, Number(o.delivery_payout_amount) || 0)
            : payoutMode === 'fixed'
              ? Math.max(0, Number(fixedPayoutRaw) || 0)
              : Math.max(0, Number(o?.delivery_fee) || 0);

        const current = rowsByDriver.get(driverId) || {
          driverId,
          driverName,
          orderCount: 0,
          deliveryTotal: 0,
          allowance: 0,
          total: 0,
          orderIds: [],
        };
        current.orderCount += 1;
        current.deliveryTotal += payout;
        if (status === 'delivered' || status === 'completed') {
          current.orderIds.push(String(o.id));
        }
        rowsByDriver.set(driverId, current);
      });

      const rows = Array.from(rowsByDriver.values())
        .map((row) => {
          const allowance = row.orderIds.length > 0
            ? Math.max(0, Number(personnelById.get(row.driverId)?.daily_allowance || 0))
            : 0;
          return { ...row, allowance, total: row.deliveryTotal + allowance };
        })
        .sort((a, b) => b.total - a.total);
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
      description: `Marcar ${row.orderIds.length} entrega(s) de ${row.driverName} como paga(s)?`,
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
      await (supabase.from('delivery_driver_ledger' as any) as any)
        .update({ settled_at: new Date().toISOString() })
        .eq('restaurant_id', user.id)
        .eq('delivery_personnel_id', driverId)
        .in('order_id', row.orderIds)
        .is('settled_at', null);
      const settledAt = new Date().toISOString();
      setHistoryRows((current) => current.map((historyRow) =>
        row.orderIds.includes(historyRow.id) ? { ...historyRow, settled: true, settledAt } : historyRow
      ));
      await loadSettlementReport();
      toast({ title: 'Pago', description: 'Acerto marcado como pago.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Não foi possível marcar como pago.', variant: 'destructive' });
    } finally {
      setSettlementLoading(false);
    }
  };

  const loadDeliveryHistory = async () => {
    if (!user?.id) return;
    setHistoryLoading(true);
    try {
      const start = new Date(`${historyStart}T00:00:00`);
      const end = new Date(`${historyEnd}T00:00:00`);
      end.setDate(end.getDate() + 1);
      if (end <= start) throw new Error('A data final deve ser igual ou posterior à data inicial.');

      let query = (supabase.from('orders' as any) as any)
        .select('id,order_number,customer_name,status,delivery_personnel_id,delivery_assigned_at,created_at,delivery_payout_amount,delivery_fee,delivery_settled,delivery_settled_at')
        .eq('user_id', user.id)
        .not('delivery_personnel_id', 'is', null)
        .gte('delivery_assigned_at', start.toISOString())
        .lt('delivery_assigned_at', end.toISOString())
        .order('delivery_assigned_at', { ascending: false })
        .limit(500);

      if (historyDriverId !== 'all') query = query.eq('delivery_personnel_id', historyDriverId);
      if (historyPaymentStatus === 'paid') query = query.eq('delivery_settled', true);
      if (historyPaymentStatus === 'pending') query = query.eq('delivery_settled', false);

      const { data, error } = await query;
      if (error) throw error;

      const nameById = new Map(deliveryPersonnel.map((person) => [person.id, person.name]));
      const rows = ((data as any[]) || []).map((order) => ({
        id: String(order.id),
        orderNumber: String(order.order_number || order.id).replace(/^PED/i, 'PED'),
        driverId: String(order.delivery_personnel_id || ''),
        driverName: nameById.get(String(order.delivery_personnel_id || '')) || 'Motoboy removido',
        customerName: String(order.customer_name || 'Cliente'),
        status: String(order.status || ''),
        assignedAt: String(order.delivery_assigned_at || order.created_at || ''),
        payout: order.delivery_payout_amount !== null && order.delivery_payout_amount !== undefined
          ? Math.max(0, Number(order.delivery_payout_amount) || 0)
          : payoutMode === 'fixed'
            ? Math.max(0, Number(String(fixedPayoutRaw).replace(',', '.')) || 0)
            : Math.max(0, Number(order.delivery_fee) || 0),
        settled: Boolean(order.delivery_settled),
        settledAt: order.delivery_settled_at ? String(order.delivery_settled_at) : null,
      }));
      setHistoryRows(rows);
    } catch (error: any) {
      setHistoryRows([]);
      toast({
        title: 'Não foi possível carregar o histórico',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadDeliveryHistory();
  }, [user?.id, historyStart, historyEnd, historyDriverId, historyPaymentStatus, deliveryPersonnel.length, payoutMode, fixedPayoutRaw]);
  
  // Handle form submission
  const onSubmit = async (data: DeliveryPersonFormValues) => {
    if (!user) return;
    const cpf = normalizeMotoboyCpf(data.cpf || '');
    const appPassword = String(data.app_password || '').trim();
    if (data.app_enabled && !isValidMotoboyCpf(cpf)) {
      form.setError('cpf', { message: 'Informe um CPF válido' });
      return;
    }
    if (data.app_enabled && (!currentDeliveryPerson || !currentDeliveryPerson.app_enabled) && appPassword.length < 6) {
      form.setError('app_password', { message: 'A senha deve ter pelo menos 6 caracteres' });
      return;
    }
    
    try {
      setIsLoading(true);
      
      if (currentDeliveryPerson) {
        // Update existing delivery person
        const { error } = await (supabase
          .from('delivery_personnel') as any)
          .update({
            name: data.name,
            phone: data.phone,
            vehicle_type: data.vehicle_type,
            vehicle_plate: data.vehicle_plate || null,
            status: data.status,
            app_enabled: data.app_enabled,
            cpf: data.app_enabled ? cpf : null,
            app_login: null,
            daily_allowance: Math.max(0, Number(data.daily_allowance || 0)),
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentDeliveryPerson.id);
        
        if (error) throw error;

        if (appPassword) {
          const { error: passwordError } = await (supabase.rpc as any)('set_delivery_personnel_app_password', {
            p_driver_id: currentDeliveryPerson.id,
            p_password: appPassword,
          });
          if (passwordError) throw passwordError;
        }
        
        toast({
          title: 'Entregador atualizado',
          description: 'As informações do entregador foram atualizadas com sucesso.',
        });
      } else {
        // Create new delivery person
        const { error, data: inserted } = await (supabase
          .from('delivery_personnel') as any)
          .insert({
            user_id: user.id,
            name: data.name,
            phone: data.phone,
            vehicle_type: data.vehicle_type,
            vehicle_plate: data.vehicle_plate || null,
            status: data.status,
            app_enabled: data.app_enabled,
            cpf: data.app_enabled ? cpf : null,
            app_login: null,
            daily_allowance: Math.max(0, Number(data.daily_allowance || 0)),
          })
          .select('id')
          .single();
        
        if (error) throw error;
        if (data.app_enabled && appPassword) {
          const { error: passwordError } = await (supabase.rpc as any)('set_delivery_personnel_app_password', {
            p_driver_id: inserted.id,
            p_password: appPassword,
          });
          if (passwordError) throw passwordError;
        }
        
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
        description: error?.code === '23505'
          ? 'Este CPF já está vinculado a outro entregador.'
          : error.message,
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
    form.setValue('app_enabled', Boolean(deliveryPerson.app_enabled));
    form.setValue('cpf', formatMotoboyCpf(deliveryPerson.cpf || ''));
    form.setValue('app_password', '');
    form.setValue('daily_allowance', Math.max(0, Number(deliveryPerson.daily_allowance || 0)));
    
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
      app_enabled: false,
      cpf: '',
      app_password: '',
      daily_allowance: 0,
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
  const historySummary = useMemo(() => {
    const summary = { total: 0, deliveryTotal: 0, allowance: 0, paid: 0, pending: 0, delivered: 0 };
    const completedByDriverDay = new Map<string, DeliveryHistoryRow[]>();

    for (const row of historyRows) {
      summary.deliveryTotal += row.payout;
      summary.total += row.payout;
      if (row.settled) summary.paid += row.payout;
      else if (row.status === 'delivered' || row.status === 'completed') summary.pending += row.payout;
      if (row.status !== 'delivered' && row.status !== 'completed') continue;

      summary.delivered += 1;
      const day = row.assignedAt ? toLocalDateInput(new Date(row.assignedAt)) : 'sem-data';
      const groupKey = `${row.driverId}:${day}`;
      completedByDriverDay.set(groupKey, [...(completedByDriverDay.get(groupKey) || []), row]);
    }

    const allowanceByDriver = new Map(deliveryPersonnel.map((person) => [
      person.id,
      Math.max(0, Number(person.daily_allowance || 0)),
    ]));
    for (const rows of completedByDriverDay.values()) {
      const allowance = allowanceByDriver.get(rows[0]?.driverId || '') || 0;
      if (!allowance) continue;
      summary.allowance += allowance;
      summary.total += allowance;
      if (rows.every((row) => row.settled)) summary.paid += allowance;
      else summary.pending += allowance;
    }

    return summary;
  }, [historyRows, deliveryPersonnel]);

  const historyStatusLabel = (status: string) => {
    if (status === 'delivered' || status === 'completed') return 'Entregue';
    if (status === 'in_delivery') return 'Em rota';
    if (status === 'cancelled') return 'Cancelado';
    if (status === 'ready') return 'Pronto';
    return 'Em andamento';
  };

  const openDriverHistory = (driverId: string) => {
    setHistoryDriverId(driverId);
    window.setTimeout(() => document.getElementById('delivery-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Entregadores</h1>
        <Button onClick={() => navigate('/equipe?tab=collaborators')}>
          <Plus className="mr-2 h-4 w-4" /> Abrir cadastro da equipe
        </Button>
      </div>

      <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#063e2d,#08704d_60%,#ff6418)] text-white shadow-lg">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><Smartphone /></div>
            <div><h2 className="text-xl font-black">App Motoboy PopSystem</h2><p className="mt-1 max-w-xl text-sm text-white/75">Cadastre CPF e senha abaixo. O motoboy recebe ofertas, organiza a rota e compartilha o rastreamento com o cliente.</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/motoboy-login`); toast({ title: 'Link copiado' }); }}><Copy className="mr-2 h-4 w-4" /> Copiar acesso</Button>
            <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => window.open('/motoboy-login', '_blank')}><ExternalLink className="mr-2 h-4 w-4" /> Abrir</Button>
          </div>
        </CardContent>
      </Card>

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
                    <TableHead>Corridas</TableHead>
                    <TableHead>Ajuda de custo</TableHead>
                    <TableHead>Total a pagar</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlementRows.map((row) => (
                    <TableRow key={row.driverId}>
                      <TableCell className="font-medium">{row.driverName}</TableCell>
                      <TableCell>{row.orderCount}</TableCell>
                      <TableCell>{formatBRL(row.deliveryTotal)}</TableCell>
                      <TableCell>{formatBRL(row.allowance)}</TableCell>
                      <TableCell>
                        <div className="font-semibold">{formatBRL(row.total)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatBRL(row.deliveryTotal)} em taxas + {formatBRL(row.allowance)} de ajuda
                        </div>
                      </TableCell>
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
          <CardDescription>Consulta operacional. Cadastro, acesso e desligamento ficam na Central da Equipe.</CardDescription>
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
                  <TableHead>App</TableHead>
                  <TableHead>Ajuda/dia</TableHead>
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
                    <TableCell>{deliveryPerson.app_enabled ? <Badge className="bg-emerald-600">Liberado</Badge> : <Badge variant="secondary">Desativado</Badge>}</TableCell>
                    <TableCell>{formatBRL(deliveryPerson.daily_allowance || 0)}</TableCell>
                    <TableCell>{settlementByDriverId.get(deliveryPerson.id)?.orderCount || 0}</TableCell>
                    <TableCell className="font-semibold">{formatBRL(settlementByDriverId.get(deliveryPerson.id)?.total || 0)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openDriverHistory(deliveryPerson.id)}
                          aria-label={`Ver histórico de ${deliveryPerson.name}`}
                          title="Ver histórico"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate('/equipe?tab=collaborators')}>Editar na Equipe</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card id="delivery-history" className="scroll-mt-24 overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-emerald-100/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-emerald-700" /> Histórico de entregas e pagamentos</CardTitle>
              <CardDescription className="mt-1">Consulte corridas, valores devidos e repasses já realizados.</CardDescription>
            </div>
            <Button variant="outline" onClick={loadDeliveryHistory} disabled={historyLoading}>
              {historyLoading ? 'Atualizando...' : 'Atualizar histórico'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <Truck className="h-5 w-5 text-emerald-700" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entregas concluídas</p>
              <p className="mt-1 text-2xl font-black">{historySummary.delivered}</p>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <Banknote className="h-5 w-5 text-slate-700" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor das corridas</p>
              <p className="mt-1 text-xl font-black">{formatBRL(historySummary.deliveryTotal)}</p>
            </div>
            <div className="rounded-2xl border bg-orange-50 p-4">
              <Banknote className="h-5 w-5 text-orange-700" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-orange-800/70">Ajuda de custo</p>
              <p className="mt-1 text-xl font-black">{formatBRL(historySummary.allowance)}</p>
            </div>
            <div className="rounded-2xl border border-slate-300 bg-slate-100 p-4">
              <Banknote className="h-5 w-5 text-slate-800" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Total geral</p>
              <p className="mt-1 text-xl font-black">{formatBRL(historySummary.total)}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <Banknote className="h-5 w-5 text-amber-700" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-800/70">Pendente</p>
              <p className="mt-1 text-xl font-black text-amber-900">{formatBRL(historySummary.pending)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <Banknote className="h-5 w-5 text-emerald-700" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Já pago</p>
              <p className="mt-1 text-xl font-black text-emerald-900">{formatBRL(historySummary.paid)}</p>
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border bg-white p-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="history-start">Data inicial</Label>
              <Input id="history-start" type="date" value={historyStart} onChange={(event) => setHistoryStart(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-end">Data final</Label>
              <Input id="history-end" type="date" value={historyEnd} onChange={(event) => setHistoryEnd(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Motoboy</Label>
              <Select value={historyDriverId} onValueChange={setHistoryDriverId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os motoboys</SelectItem>
                  {deliveryPersonnel.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Situação do repasse</Label>
              <Select value={historyPaymentStatus} onValueChange={(value) => setHistoryPaymentStatus(value as 'all' | 'pending' | 'paid')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {historyLoading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando histórico...</div>
          ) : historyRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-10 text-center text-muted-foreground">Nenhuma entrega encontrada para os filtros selecionados.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Motoboy</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Repasse</TableHead>
                    <TableHead>Pago em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRows.map((row) => {
                    const completed = row.status === 'delivered' || row.status === 'completed';
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">{row.assignedAt ? new Date(row.assignedAt).toLocaleString('pt-BR') : '-'}</TableCell>
                        <TableCell className="font-semibold">#{row.orderNumber}</TableCell>
                        <TableCell>{row.driverName}</TableCell>
                        <TableCell>{row.customerName}</TableCell>
                        <TableCell><Badge variant="outline">{historyStatusLabel(row.status)}</Badge></TableCell>
                        <TableCell className="font-semibold">{formatBRL(row.payout)}</TableCell>
                        <TableCell>
                          {row.settled
                            ? <Badge className="bg-emerald-600">Pago</Badge>
                            : completed
                              ? <Badge className="bg-amber-500">A pagar</Badge>
                              : <Badge variant="secondary">Não liberado</Badge>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{row.settledAt ? new Date(row.settledAt).toLocaleString('pt-BR') : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {historyRows.length >= 500 && <p className="text-xs text-muted-foreground">Exibindo as 500 entregas mais recentes do período. Reduza o intervalo para consultar mais detalhes.</p>}
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

              <div className="rounded-2xl border bg-slate-50 p-4">
                <FormField
                  control={form.control}
                  name="app_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4">
                      <div><FormLabel className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Acesso ao App Motoboy</FormLabel><p className="mt-1 text-xs text-muted-foreground">Permite receber e concluir entregas pelo celular.</p></div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )}
                />
                {form.watch('app_enabled') && <div className="mt-4 grid gap-4">
                  <FormField control={form.control} name="cpf" render={({ field }) => <FormItem><FormLabel>CPF para acesso</FormLabel><FormControl><Input inputMode="numeric" autoComplete="username" maxLength={14} placeholder="000.000.000-00" {...field} onChange={(event) => field.onChange(formatMotoboyCpf(event.target.value))} /></FormControl><p className="text-xs text-muted-foreground">Será usado junto com a senha para entrar no App Motoboy.</p><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="app_password" render={({ field }) => <FormItem><FormLabel className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> {currentDeliveryPerson ? 'Nova senha (opcional)' : 'Senha inicial'}</FormLabel><FormControl><Input type="password" autoComplete="new-password" placeholder={currentDeliveryPerson ? 'Deixe em branco para manter' : 'Mínimo de 6 caracteres'} {...field} /></FormControl><FormMessage /></FormItem>} />
                </div>}
              </div>
              
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
                name="daily_allowance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ajuda de custo diária</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-semibold text-muted-foreground">R$</span>
                        <Input
                          className="pl-10"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={field.value ?? 0}
                          onChange={(event) => field.onChange(Number(event.target.value || 0))}
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Somada uma vez no fechamento do dia quando houver ao menos uma entrega concluída.
                    </p>
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
