import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentConsole } from '@/components/agent/AgentConsole';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  DollarSign, 
  TrendingUp, 
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Bot,
  Settings
} from 'lucide-react';
import { PrinterConfig } from '@/components/printer/PrinterConfig';

interface DashboardStats {
  totalIngredients: number;
  activeIngredients: number;
  totalExpenses: number;
  monthlyExpenses: number;
  recentActivities: AgentActivity[];
}

interface AgentActivity {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  metadata?: any;
}

export function AgentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalIngredients: 0,
    activeIngredients: 0,
    totalExpenses: 0,
    monthlyExpenses: 0,
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load ingredients stats
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('ingredients')
        .select('is_active')
        .eq('user_id', user.id);

      if (ingredientsError) throw ingredientsError;

      // Load expenses stats
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, expense_date')
        .eq('user_id', user.id);

      if (expensesError) throw expensesError;

      // Load recent activities
      const { data: activities, error: activitiesError } = await supabase
        .from('agent_activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (activitiesError) throw activitiesError;

      // Calculate stats
      const totalIngredients = ingredients?.length || 0;
      const activeIngredients = ingredients?.filter(ing => ing.is_active).length || 0;
      const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
      const monthlyExpenses = expenses
        ?.filter(exp => exp.expense_date.startsWith(currentMonth))
        .reduce((sum, exp) => sum + exp.amount, 0) || 0;

      setStats({
        totalIngredients,
        activeIngredients,
        totalExpenses,
        monthlyExpenses,
        recentActivities: activities || []
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActivityIcon = (actionType: string) => {
    switch (actionType) {
      case 'ingredient_disable':
        return <Package className="h-4 w-4 text-orange-500" />;
      case 'expense_register':
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'command_received':
        return <Bot className="h-4 w-4 text-blue-500" />;
      case 'command_error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityColor = (actionType: string) => {
    switch (actionType) {
      case 'ingredient_disable':
        return 'bg-orange-100 text-orange-800';
      case 'expense_register':
        return 'bg-green-100 text-green-800';
      case 'command_received':
        return 'bg-blue-100 text-blue-800';
      case 'command_error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-orange-600 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-3 border-white/20 bg-white/10 text-lime-100 hover:bg-white/10">Pop Agente</Badge>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Sua ajuda inteligente no PopSystem</h1>
            <p className="mt-2 max-w-3xl text-white/80">
              Tire dúvidas e execute tarefas por conversa: cardápio, despesas, produtos, imagens, relatórios e ajustes operacionais.
            </p>
          </div>
          <Button onClick={loadDashboardData} variant="secondary" size="sm" className="w-fit bg-white text-emerald-950 hover:bg-white/90">
            <Activity className="h-4 w-4 mr-2" />
            Atualizar painel
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingredientes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalIngredients}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeIngredients} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.monthlyExpenses)}</div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(stats.totalExpenses)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Execuções Recentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentActivities.length}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status do Pop Agente</CardTitle>
            <Bot className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-600">Online</div>
            <p className="text-xs text-muted-foreground">
              Pronto para comandos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="console" className="space-y-4">
        <TabsList>
          <TabsTrigger value="console">Chat</TabsTrigger>
          <TabsTrigger value="activities">Atividades</TabsTrigger>
          <TabsTrigger value="quick-actions">Ações Rápidas</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="console" className="space-y-4">
          <AgentConsole />
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Atividades Recentes</CardTitle>
              <CardDescription>
                Histórico de comandos executados pelo assistente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.recentActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma atividade recente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="flex-shrink-0">
                        {getActivityIcon(activity.action_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={getActivityColor(activity.action_type)}>
                            {activity.action_type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatDate(activity.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quick-actions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Controle de Ingredientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    // This would trigger a command in the console
                    const consoleInput = document.querySelector('textarea[placeholder="Pergunte ou peça uma ação ao Pop Agente..."]') as HTMLTextAreaElement;
                    if (consoleInput) {
                      consoleInput.value = 'Mostrar ingredientes ativos';
                      consoleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                >
                  Ver Ingredientes Ativos
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    const consoleInput = document.querySelector('textarea[placeholder="Pergunte ou peça uma ação ao Pop Agente..."]') as HTMLTextAreaElement;
                    if (consoleInput) {
                      consoleInput.value = 'Desativar carne de sol de todos os produtos';
                      consoleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                >
                  Desativar Carne de Sol
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    const consoleInput = document.querySelector('textarea[placeholder="Pergunte ou peça uma ação ao Pop Agente..."]') as HTMLTextAreaElement;
                    if (consoleInput) {
                      consoleInput.value = 'Desativar queijo coalho de todos os produtos';
                      consoleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                >
                  Desativar Queijo Coalho
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Lançamento de Despesas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    const consoleInput = document.querySelector('textarea[placeholder="Pergunte ou peça uma ação ao Pop Agente..."]') as HTMLTextAreaElement;
                    if (consoleInput) {
                      consoleInput.value = 'Lançar despesa de R$ 150,00 para alimentação';
                      consoleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                >
                  Despesa Alimentação R$ 150,00
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    const consoleInput = document.querySelector('textarea[placeholder="Pergunte ou peça uma ação ao Pop Agente..."]') as HTMLTextAreaElement;
                    if (consoleInput) {
                      consoleInput.value = 'Lançar despesa de R$ 50,00 para transporte';
                      consoleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                >
                  Despesa Transporte R$ 50,00
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    const consoleInput = document.querySelector('textarea[placeholder="Pergunte ou peça uma ação ao Pop Agente..."]') as HTMLTextAreaElement;
                    if (consoleInput) {
                      consoleInput.value = 'Lançar despesa de R$ 200,00 para insumos';
                      consoleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                >
                  Despesa Insumos R$ 200,00
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <PrinterConfig />
            {/* Outras configs podem vir aqui */}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AgentDashboard;
