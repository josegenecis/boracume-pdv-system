
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, Star, Users, Trophy, Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LoyaltyCustomer {
  id: string;
  customer_name: string;
  customer_phone: string;
  points: number;
  total_spent: number;
  visits_count: number;
  created_at: string;
}

interface LoyaltyReward {
  id: string;
  name: string;
  points_required: number;
  description?: string;
  active: boolean;
}

const LoyaltyManager = () => {
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [newReward, setNewReward] = useState({
    name: '',
    points_required: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchCustomers(),
        fetchRewards()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_customers')
        .select('*')
        .eq('user_id', user?.id)
        .order('points', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setCustomers([]);
    }
  };

  const fetchRewards = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('user_id', user?.id)
        .order('points_required');

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error('Erro ao carregar recompensas:', error);
      setRewards([]);
    }
  };

  const addReward = async () => {
    if (!newReward.name.trim() || !newReward.points_required) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome da recompensa e os pontos necessários.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .insert([{
          user_id: user?.id,
          name: newReward.name.trim(),
          points_required: parseInt(newReward.points_required),
          description: newReward.description.trim() || null,
          active: true
        }])
        .select()
        .single();

      if (error) throw error;

      setRewards(prev => [...prev, data]);
      setNewReward({ name: '', points_required: '', description: '' });

      toast({
        title: "Recompensa adicionada",
        description: `${data.name} foi adicionada ao programa de fidelidade.`,
      });
    } catch (error: any) {
      console.error('Erro ao adicionar recompensa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a recompensa.",
        variant: "destructive"
      });
    }
  };

  const toggleRewardStatus = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('loyalty_rewards')
        .update({ active: !active })
        .eq('id', id);

      if (error) throw error;

      setRewards(prev => 
        prev.map(reward => 
          reward.id === id ? { ...reward, active: !active } : reward
        )
      );

      toast({
        title: "Status atualizado",
        description: `Recompensa ${!active ? 'ativada' : 'desativada'} com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao atualizar recompensa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a recompensa.",
        variant: "destructive"
      });
    }
  };

  const redeemReward = async (customerId: string, rewardId: string, pointsRequired: number) => {
    try {
      const customer = customers.find(c => c.id === customerId);
      if (!customer || customer.points < pointsRequired) {
        toast({
          title: "Pontos insuficientes",
          description: "O cliente não possui pontos suficientes para esta recompensa.",
          variant: "destructive"
        });
        return;
      }

      // Criar registro de resgate
      const { error: redemptionError } = await supabase
        .from('loyalty_redemptions')
        .insert([{
          customer_id: customerId,
          reward_id: rewardId,
          points_used: pointsRequired
        }]);

      if (redemptionError) throw redemptionError;

      // Atualizar pontos do cliente
      const { error: updateError } = await supabase
        .from('loyalty_customers')
        .update({ points: customer.points - pointsRequired })
        .eq('id', customerId);

      if (updateError) throw updateError;

      await fetchCustomers();

      toast({
        title: "Recompensa resgatada",
        description: `Recompensa resgatada com sucesso! ${pointsRequired} pontos foram deduzidos.`,
      });
    } catch (error) {
      console.error('Erro ao resgatar recompensa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível resgatar a recompensa.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Programa de Fidelidade</h1>
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users size={16} />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2">
            <Gift size={16} />
            Recompensas
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <Trophy size={16} />
            Estatísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clientes do Programa</CardTitle>
            </CardHeader>
            <CardContent>
              {customers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhum cliente cadastrado ainda.</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Os clientes são adicionados automaticamente quando fazem pedidos.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {customers.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{customer.customer_name}</h3>
                        <p className="text-sm text-gray-600">{customer.customer_phone}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500" />
                            {customer.points} pontos
                          </span>
                          <span>Total gasto: {formatCurrency(customer.total_spent)}</span>
                          <span>{customer.visits_count} visitas</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          Desde {formatDate(customer.created_at)}
                        </Badge>
                        {rewards.filter(r => r.active && customer.points >= r.points_required).length > 0 && (
                          <div className="space-x-2">
                            {rewards
                              .filter(r => r.active && customer.points >= r.points_required)
                              .map(reward => (
                                <Button
                                  key={reward.id}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => redeemReward(customer.id, reward.id, reward.points_required)}
                                >
                                  Resgatar: {reward.name}
                                </Button>
                              ))
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Nova Recompensa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  placeholder="Nome da recompensa"
                  value={newReward.name}
                  onChange={(e) => setNewReward(prev => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Pontos necessários"
                  value={newReward.points_required}
                  onChange={(e) => setNewReward(prev => ({ ...prev, points_required: e.target.value }))}
                />
                <Input
                  placeholder="Descrição (opcional)"
                  value={newReward.description}
                  onChange={(e) => setNewReward(prev => ({ ...prev, description: e.target.value }))}
                />
                <Button onClick={addReward} className="flex items-center gap-2">
                  <Plus size={16} />
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recompensas Cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              {rewards.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhuma recompensa cadastrada ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rewards.map((reward) => (
                    <div key={reward.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{reward.name}</h3>
                        {reward.description && (
                          <p className="text-sm text-gray-600">{reward.description}</p>
                        )}
                        <p className="text-sm text-orange-600 font-medium">
                          {reward.points_required} pontos necessários
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={reward.active ? "default" : "secondary"}>
                          {reward.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleRewardStatus(reward.id, reward.active)}
                        >
                          {reward.active ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{customers.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pontos Totais Distribuídos</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {customers.reduce((total, customer) => total + customer.points, 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recompensas Ativas</CardTitle>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {rewards.filter(r => r.active).length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Como Funciona o Programa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Acúmulo de Pontos</h4>
                  <p className="text-blue-800 text-sm">
                    • Clientes ganham 1 ponto para cada R$ 1,00 gasto
                  </p>
                  <p className="text-blue-800 text-sm">
                    • Pontos são creditados automaticamente quando o pedido é marcado como "entregue"
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Resgate de Recompensas</h4>
                  <p className="text-green-800 text-sm">
                    • Você pode resgatar recompensas manualmente para os clientes
                  </p>
                  <p className="text-green-800 text-sm">
                    • Os pontos são automaticamente deduzidos da conta do cliente
                  </p>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-2">Configuração</h4>
                  <p className="text-orange-800 text-sm">
                    • Crie recompensas atrativas para incentivar o retorno dos clientes
                  </p>
                  <p className="text-orange-800 text-sm">
                    • Defina quantos pontos são necessários para cada recompensa
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LoyaltyManager;
