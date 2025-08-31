import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PaymentMethod {
  id?: string;
  name: string;
  observation: string;
  extraFeePercent: number;
  isCard: boolean;
}

const PaymentMethodsSettings: React.FC = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMethod, setNewMethod] = useState<PaymentMethod>({
    name: '',
    observation: '',
    extraFeePercent: 0,
    isCard: false
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadMethods().then(async (loaded) => {
        if (loaded && loaded.length === 0) {
          // Seed formas de pagamento padrão
          const defaultMethods = [
            { name: 'Dinheiro', observation: '', extraFeePercent: 0, isCard: false },
            { name: 'Pix', observation: '', extraFeePercent: 0, isCard: false },
            { name: 'Cartão de Crédito', observation: '', extraFeePercent: 0, isCard: true },
            { name: 'Cartão de Débito', observation: '', extraFeePercent: 0, isCard: true }
          ];
          for (const method of defaultMethods) {
            await supabase.from('payment_methods').insert({
              user_id: user.id,
              name: method.name,
              observation: method.observation,
              extra_fee_percent: method.extraFeePercent,
              is_card: method.isCard
            });
          }
          loadMethods();
        }
      });
    }
  }, [user]);

  const loadMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');
      if (error) throw error;
      // Corrigir o mapeamento dos campos do banco para o formato esperado pelo estado
      const mapped = (data || []).map((m: any) => ({
        ...m,
        extraFeePercent: m.extra_fee_percent ?? 0,
        isCard: m.is_card ?? false
      }));
      setMethods(mapped);
      return mapped;
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível carregar as formas de pagamento.', variant: 'destructive' });
      return [];
    }
  };

  const handleInputChange = (field: keyof PaymentMethod, value: string | boolean | number) => {
    setNewMethod(prev => ({ ...prev, [field]: value }));
  };

  const addMethod = async () => {
    if (!newMethod.name.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Informe o nome da forma de pagamento.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const methodData = {
        user_id: user?.id,
        name: newMethod.name.trim(),
        observation: newMethod.observation,
        extra_fee_percent: newMethod.isCard ? newMethod.extraFeePercent : 0,
        is_card: newMethod.isCard
      };
      const { data, error } = await supabase
        .from('payment_methods')
        .insert([methodData])
        .select()
        .single();
      if (error) throw error;
      setMethods(prev => [...prev, { ...data, extraFeePercent: data.extra_fee_percent, isCard: data.is_card }]);
      setNewMethod({ name: '', observation: '', extraFeePercent: 0, isCard: false });
      toast({ title: 'Adicionado', description: 'Forma de pagamento adicionada.' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível adicionar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const removeMethod = async (id?: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('payment_methods').delete().eq('id', id);
      if (error) throw error;
      setMethods(prev => prev.filter(m => m.id !== id));
      toast({ title: 'Removido', description: 'Forma de pagamento removida.' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível remover.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleMethodChange = (index: number, field: keyof PaymentMethod, value: string | boolean | number) => {
    setMethods(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const saveMethod = async (method: PaymentMethod) => {
    if (!method.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({
          name: method.name,
          observation: method.observation,
          extra_fee_percent: method.isCard ? method.extraFeePercent : 0,
          is_card: method.isCard
        })
        .eq('id', method.id);
      if (error) throw error;
      toast({ title: 'Salvo', description: 'Forma de pagamento atualizada.' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Formas de Pagamento</CardTitle>
          <CardDescription>Gerencie as formas de pagamento aceitas pelo restaurante. Adicione observações e configure taxa extra para cartão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment-name">Nome</Label>
              <Input id="payment-name" value={newMethod.name} onChange={e => handleInputChange('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-observation">Observação</Label>
              <Input id="payment-observation" value={newMethod.observation} onChange={e => handleInputChange('observation', e.target.value)} />
            </div>
            <div className="space-y-2 flex items-center gap-2">
              <Switch id="is-card" checked={newMethod.isCard} onCheckedChange={checked => handleInputChange('isCard', checked)} />
              <Label htmlFor="is-card">É cartão?</Label>
              {newMethod.isCard && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="extra-fee">Taxa extra (%)</Label>
                  <Input id="extra-fee" type="number" min="0" step="0.01" value={newMethod.extraFeePercent} onChange={e => handleInputChange('extraFeePercent', Number(e.target.value))} className="w-24" />
                </div>
              )}
            </div>
            <div className="flex items-end">
              <Button onClick={addMethod} disabled={loading} className="w-full md:w-auto">
                <Plus size={16} className="mr-2" />Adicionar
              </Button>
            </div>
          </div>
          <hr />
          <div className="space-y-4">
            {methods.length === 0 && <p className="text-muted-foreground">Nenhuma forma de pagamento cadastrada.</p>}
            {methods.map((method, idx) => (
              <div key={method.id || idx} className="flex flex-col md:flex-row md:items-center gap-2 border rounded p-3">
                <Input value={method.name} onChange={e => handleMethodChange(idx, 'name', e.target.value)} className="md:w-1/4" />
                <Input value={method.observation} onChange={e => handleMethodChange(idx, 'observation', e.target.value)} className="md:w-1/3" />
                <div className="flex items-center gap-2">
                  <Switch checked={method.isCard} onCheckedChange={checked => handleMethodChange(idx, 'isCard', checked)} />
                  <span>Cartão</span>
                  {method.isCard && (
                    <>
                      <Label className="ml-2">Taxa (%)</Label>
                      <Input type="number" min="0" step="0.01" value={method.extraFeePercent} onChange={e => handleMethodChange(idx, 'extraFeePercent', Number(e.target.value))} className="w-20" />
                    </>
                  )}
                </div>
                <Button variant="outline" onClick={() => saveMethod(method)} disabled={loading} className="md:w-auto">
                  <Save size={16} className="mr-1" />Salvar
                </Button>
                <Button variant="destructive" onClick={() => removeMethod(method.id)} disabled={loading} className="md:w-auto">
                  <Trash2 size={16} className="mr-1" />Remover
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentMethodsSettings;