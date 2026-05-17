import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, Star, Users, Trophy, Plus, Trash2, Tag, Percent, Truck, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import AdminPinDialog from '@/components/security/AdminPinDialog';
import { verifyAdminPin } from '@/services/adminPin';
import { CurrencyTextInput } from '@/components/ui/currency-text-input';
import { formatBRL, parseBRL } from '@/lib/currency';

interface LoyaltyProgram {
  id: string;
  type: 'points' | 'visits' | 'spending' | 'shipping';
  goal_value: number;
  point_value?: number | null;
  reward_type: 'percent' | 'fixed_amount' | 'free_product' | 'free_shipping';
  reward_value: number;
  active: boolean;
  notify_whatsapp: boolean;
}

interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: 'percent' | 'fixed' | 'shipping';
  discount_value: number;
  min_purchase: number;
  active: boolean;
}

const LoyaltyManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [adminPinOpen, setAdminPinOpen] = useState(false);
  const [pendingDeleteProgramId, setPendingDeleteProgramId] = useState<string | null>(null);
  
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  
  // New Program State
  const [newProgram, setNewProgram] = useState<Partial<LoyaltyProgram>>({
    type: 'visits',
    goal_value: 10,
    point_value: 15,
    reward_type: 'percent',
    reward_value: 10,
    active: true,
    notify_whatsapp: false
  });

  const isNotifyWhatsappSchemaError = (message?: string) =>
    typeof message === 'string' &&
    message.toLowerCase().includes('notify_whatsapp') &&
    message.toLowerCase().includes('loyalty_programs');

  const isLoyaltyProgramColumnError = (message?: string, column?: string) =>
    typeof message === 'string' &&
    (!column || message.toLowerCase().includes(column.toLowerCase())) &&
    message.toLowerCase().includes('loyalty_programs');

  // New Coupon State
  const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({
    code: '',
    description: '',
    discount_type: 'percent',
    discount_value: 10,
    min_purchase: 0,
    active: true
  });

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [progRes, coupRes] = await Promise.all([
        supabase.from('loyalty_programs').select('*').eq('user_id', user?.id),
        supabase.from('coupons').select('*').eq('user_id', user?.id)
      ]);

      // Don't throw error if tables don't exist yet, just empty list
      if (progRes.error && progRes.error.code !== '42P01') console.error(progRes.error);
      if (coupRes.error && coupRes.error.code !== '42P01') console.error(coupRes.error);

      setPrograms(progRes.data as any || []);
      setCoupons(coupRes.data as any || []);
    } catch (error) {
      console.error('Error fetching promo data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProgram = async () => {
    try {
      const normalizedProgram = {
        ...newProgram,
        point_value: newProgram.type === 'spending' ? Math.max(0, Number(newProgram.point_value || 0)) : null,
      };

      if (normalizedProgram.type === 'spending') {
        if (!normalizedProgram.point_value) {
          toast({ title: 'Informe o valor da estrelinha', description: 'Defina quanto o cliente precisa comprar para ganhar 1 estrelinha.', variant: 'destructive' });
          return;
        }
        if (!normalizedProgram.goal_value || Number(normalizedProgram.goal_value) < Number(normalizedProgram.point_value)) {
          toast({ title: 'Revise o prêmio', description: 'O valor total para ganhar o prêmio precisa ser maior ou igual ao valor de 1 estrelinha.', variant: 'destructive' });
          return;
        }
      }

      const payload = {
        user_id: user?.id,
        ...normalizedProgram
      };

      let result = await supabase.from('loyalty_programs').insert(payload).select().single();

      if (result.error && isNotifyWhatsappSchemaError(result.error.message)) {
        const { notify_whatsapp, ...fallbackPayload } = payload;
        result = await supabase.from('loyalty_programs').insert(fallbackPayload).select().single();
      }

      if (result.error && isLoyaltyProgramColumnError(result.error.message, 'point_value')) {
        const { point_value, ...fallbackPayload } = payload;
        result = await supabase.from('loyalty_programs').insert(fallbackPayload).select().single();
      }

      const { data, error } = result;

      if (error) throw error;
      setPrograms([...programs, { notify_whatsapp: false, ...(data as any) }]);
      toast({ title: 'Programa criado com sucesso!' });
      setNewProgram({
        type: 'visits',
        goal_value: 10,
        point_value: 15,
        reward_type: 'percent',
        reward_value: 10,
        active: true,
        notify_whatsapp: false
      });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao criar programa', 
        description: error.message?.includes('relation "public.loyalty_programs" does not exist') 
          ? 'A tabela de fidelidade ainda não foi criada no banco.' 
          : error.message,
        variant: 'destructive' 
      });
    }
  };

  const deleteProgram = async (id: string) => {
    try {
      const rewardDeleteResult = await supabase
        .from('customer_rewards')
        .delete({ count: 'exact' })
        .eq('program_id', id)
        .eq('user_id', user?.id);

      if (rewardDeleteResult.error && rewardDeleteResult.error.code !== '42P01') {
        throw rewardDeleteResult.error;
      }

      const { error, count } = await supabase
        .from('loyalty_programs')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      if (!count) throw new Error('A regra não foi removida do banco.');
      setPrograms(programs.filter(p => p.id !== id));
      toast({ title: 'Programa removido' });
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: String(error?.message || ''), variant: 'destructive' });
    }
  };

  const requestDeleteProgram = (id: string) => {
    setPendingDeleteProgramId(id);
    setAdminPinOpen(true);
  };

  const handleConfirmDeleteProgram = async (pin: string) => {
    if (!user?.id || !pendingDeleteProgramId) return;
    const result = await verifyAdminPin({ restaurantUserId: user.id, pin });
    if (!result.ok) {
      toast({ title: 'PIN inválido', description: 'Informe a senha do administrador para excluir a regra.', variant: 'destructive' });
      return;
    }

    const programId = pendingDeleteProgramId;
    setAdminPinOpen(false);
    setPendingDeleteProgramId(null);
    await deleteProgram(programId);
  };

  const createCoupon = async () => {
    if (!newCoupon.code) return toast({ title: 'Código obrigatório', variant: 'destructive' });
    try {
      const { data, error } = await supabase.from('coupons').insert({
        user_id: user?.id,
        ...newCoupon,
        code: newCoupon.code.toUpperCase()
      }).select().single();

      if (error) throw error;
      setCoupons([...coupons, data as any]);
      setNewCoupon({ ...newCoupon, code: '' }); // Reset code
      toast({ title: 'Cupom criado!' });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao criar cupom',
        description: error.message?.includes('relation "public.coupons" does not exist') 
          ? 'A tabela de cupons ainda não foi criada no banco.' 
          : error.message, 
        variant: 'destructive' 
      });
    }
  };

  const deleteCoupon = async (id: string) => {
    try {
      const { error, count } = await supabase
        .from('coupons')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      if (!count) throw new Error('O cupom não foi removido do banco.');
      setCoupons(coupons.filter(c => c.id !== id));
      toast({ title: 'Cupom removido' });
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: String(error?.message || ''), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Promoções & Fidelidade</h1>
      </div>

      <Tabs defaultValue="programs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="programs" className="gap-2"><Star size={16} /> Regras de Fidelidade</TabsTrigger>
          <TabsTrigger value="coupons" className="gap-2"><Tag size={16} /> Cupons de Desconto</TabsTrigger>
        </TabsList>

        {/* --- ABAS DE PROGRAMAS DE FIDELIDADE --- */}
        <TabsContent value="programs" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            
            {/* Criar Novo Programa */}
            <Card>
              <CardHeader>
                <CardTitle>Criar Nova Regra</CardTitle>
                <CardDescription>Configure recompensas automáticas para seus clientes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Meta</Label>
                  <Select 
                    value={newProgram.type} 
                    onValueChange={(v: any) => setNewProgram({
                      ...newProgram,
                      type: v,
                      point_value: v === 'spending' ? (newProgram.point_value || 15) : null
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visits">A cada X Pedidos (Frequência)</SelectItem>
                      <SelectItem value="spending">Valor acumulado com estrelinhas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newProgram.type === 'spending' ? (
                  <>
                    <div className="space-y-2 rounded-lg border border-green-100 bg-green-50/50 p-3">
                      <Label>Valor mínimo para ganhar 1 estrelinha</Label>
                      <CurrencyTextInput
                        value={formatBRL(newProgram.point_value || 0)}
                        onValueChange={(value) => setNewProgram({ ...newProgram, point_value: parseBRL(value) })}
                      />
                      <p className="text-xs text-gray-600">Exemplo: se colocar R$ 15,00, cada R$ 15,00 em compras entregues vira 1 estrelinha.</p>
                    </div>

                    <div className="space-y-2 rounded-lg border border-orange-100 bg-orange-50/50 p-3">
                      <Label>Valor total acumulado para ganhar o prêmio</Label>
                      <CurrencyTextInput
                        value={formatBRL(newProgram.goal_value || 0)}
                        onValueChange={(value) => setNewProgram({ ...newProgram, goal_value: parseBRL(value) })}
                      />
                      <p className="text-xs text-gray-600">O desconto só é liberado quando o cliente acumular esse total. Antes disso ele apenas junta estrelinhas.</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>Quantidade de pedidos para ganhar o prêmio</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newProgram.goal_value}
                      onChange={e => setNewProgram({...newProgram, goal_value: Number(e.target.value)})}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Tipo de Recompensa</Label>
                  <Select 
                    value={newProgram.reward_type} 
                    onValueChange={(v: any) => setNewProgram({...newProgram, reward_type: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Desconto (%)</SelectItem>
                      <SelectItem value="fixed_amount">Desconto em Dinheiro (R$)</SelectItem>
                      <SelectItem value="free_shipping">Frete Grátis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newProgram.reward_type !== 'free_shipping' && (
                  <div className="space-y-2">
                    <Label>Valor da Recompensa</Label>
                    {newProgram.reward_type === 'fixed_amount' ? (
                      <CurrencyTextInput
                        value={formatBRL(newProgram.reward_value || 0)}
                        onValueChange={(value) => setNewProgram({ ...newProgram, reward_value: parseBRL(value) })}
                      />
                    ) : (
                      <Input
                        type="number"
                        value={newProgram.reward_value}
                        onChange={e => setNewProgram({...newProgram, reward_value: Number(e.target.value)})}
                      />
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2 border p-3 rounded-lg bg-gray-50">
                  <Switch 
                    id="whatsapp-notify" 
                    checked={newProgram.notify_whatsapp}
                    onCheckedChange={(c) => setNewProgram({...newProgram, notify_whatsapp: c})}
                  />
                  <div className="flex-1">
                    <Label htmlFor="whatsapp-notify" className="cursor-pointer flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      Notificar Cliente via WhatsApp
                    </Label>
                    <p className="text-xs text-gray-500">Envia mensagem automática quando atingir a meta.</p>
                  </div>
                </div>

                <Button onClick={createProgram} className="w-full bg-green-600 hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" /> Criar Regra Automática
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Programas Ativos */}
            <div className="space-y-4">
              {programs.map(prog => (
                <Card key={prog.id}>
                  <CardContent className="pt-6 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        {prog.type === 'visits' ? `A cada ${prog.goal_value} pedidos` : `${formatBRL(prog.point_value || prog.goal_value)} = 1 estrelinha`}
                        {prog.notify_whatsapp && <MessageCircle className="h-4 w-4 text-green-500" title="Notifica via WhatsApp" />}
                      </h3>
                      <p className="text-gray-500">
                        {prog.type === 'spending' && (
                          <span className="block text-sm text-gray-500">Prêmio ao acumular {formatBRL(prog.goal_value)}</span>
                        )}
                        Ganha: {prog.reward_type === 'free_shipping' ? 'Frete Grátis' : 
                                prog.reward_type === 'percent' ? `${prog.reward_value}% OFF` : 
                                `${formatBRL(prog.reward_value)} OFF`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => requestDeleteProgram(prog.id)}>
                      <Trash2 className="h-5 w-5 text-red-500" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {programs.length === 0 && (
                <div className="text-center text-gray-500 py-10">Nenhuma regra ativa.</div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* --- ABAS DE CUPONS --- */}
        <TabsContent value="coupons" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            
            {/* Criar Cupom */}
            <Card>
              <CardHeader>
                <CardTitle>Criar Cupom de Desconto</CardTitle>
                <CardDescription>Códigos promocionais para campanhas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Código do Cupom (Ex: NATAL10)</Label>
                  <Input 
                    placeholder="BORA10" 
                    value={newCoupon.code} 
                    onChange={e => setNewCoupon({...newCoupon, code: e.target.value})}
                    className="uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select 
                      value={newCoupon.discount_type} 
                      onValueChange={(v: any) => setNewCoupon({...newCoupon, discount_type: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Porcentagem (%)</SelectItem>
                        <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                        <SelectItem value="shipping">Frete Grátis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newCoupon.discount_type !== 'shipping' && (
                    <div className="space-y-2">
                      <Label>Valor</Label>
                      {newCoupon.discount_type === 'fixed' ? (
                        <CurrencyTextInput
                          value={formatBRL(newCoupon.discount_value || 0)}
                          onValueChange={(value) => setNewCoupon({ ...newCoupon, discount_value: parseBRL(value) })}
                        />
                      ) : (
                        <Input
                          type="number"
                          value={newCoupon.discount_value}
                          onChange={e => setNewCoupon({...newCoupon, discount_value: Number(e.target.value)})}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Compra Mínima (R$)</Label>
                  <CurrencyTextInput
                    value={formatBRL(newCoupon.min_purchase || 0)}
                    onValueChange={(value) => setNewCoupon({...newCoupon, min_purchase: parseBRL(value)})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição (Opcional)</Label>
                  <Input 
                    value={newCoupon.description} 
                    onChange={e => setNewCoupon({...newCoupon, description: e.target.value})}
                  />
                </div>

                <Button onClick={createCoupon} className="w-full bg-blue-600 hover:bg-blue-700">
                  <Tag className="mr-2 h-4 w-4" /> Criar Cupom
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Cupons */}
            <div className="space-y-4">
              {coupons.map(coupon => (
                <Card key={coupon.id}>
                  <CardContent className="pt-6 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-lg font-bold px-3 py-1 bg-blue-100 text-blue-800">
                          {coupon.code}
                        </Badge>
                        {coupon.min_purchase > 0 && <span className="text-xs text-gray-500">Min: {formatBRL(coupon.min_purchase)}</span>}
                      </div>
                      <p className="text-gray-600 mt-1">
                        {coupon.discount_type === 'shipping' ? 'Frete Grátis' : 
                         coupon.discount_type === 'percent' ? `${coupon.discount_value}% de Desconto` : 
                         `${formatBRL(coupon.discount_value)} de Desconto`}
                      </p>
                      {coupon.description && <p className="text-xs text-gray-400">{coupon.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteCoupon(coupon.id)}>
                      <Trash2 className="h-5 w-5 text-red-500" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {coupons.length === 0 && (
                <div className="text-center text-gray-500 py-10">Nenhum cupom ativo.</div>
              )}
            </div>
          </div>
        </TabsContent>

      </Tabs>
      <AdminPinDialog
        open={adminPinOpen}
        title="Excluir regra de fidelidade"
        description="Digite o PIN do administrador para confirmar a exclusão da regra."
        confirmLabel="Excluir regra"
        onCancel={() => {
          setAdminPinOpen(false);
          setPendingDeleteProgramId(null);
        }}
        onConfirm={handleConfirmDeleteProgram}
      />
    </div>
  );
};

export default LoyaltyManager;
