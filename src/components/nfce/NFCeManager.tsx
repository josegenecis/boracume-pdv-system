
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Receipt, Search, Download, Eye, RotateCcw, PlayCircle, AlertTriangle, Printer, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PrinterService } from '@/utils/printerService';

interface NFCeCupom {
  id: string;
  numero: number;
  serie: string;
  chave_acesso?: string;
  data_hora_emissao: string;
  data_hora_autorizacao?: string;
  valor_total: number;
  consumidor_nome?: string;
  consumidor_cpf_cnpj?: string;
  status: string;
  motivo_rejeicao?: string;
  protocolo_autorizacao?: string;
  contingencia: boolean;
  order_id?: string;
  sale_order_number?: string;
  model_code?: '55' | '65';
}

const NFCeManager: React.FC = () => {
  const [cupons, setCupons] = useState<NFCeCupom[]>([]);
  const [filteredCupons, setFilteredCupons] = useState<NFCeCupom[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [resendingCupomId, setResendingCupomId] = useState<string | null>(null);
  const { toast } = useToast();
  const confirm = useConfirmDialog();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadCupons();
    }
  }, [user]);

  useEffect(() => {
    filterCupons();
  }, [cupons, searchQuery, statusFilter]);

  const loadCupons = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nfce_cupons')
        .select('*')
        .eq('user_id', user?.id)
        .order('data_hora_emissao', { ascending: false });

      if (error) throw error;
      const coupons = (data || []) as NFCeCupom[];
      const orderIds = Array.from(new Set(coupons.map((coupon) => coupon.order_id).filter(Boolean))) as string[];
      let orderNumbers = new Map<string, string>();
      if (orderIds.length > 0) {
        const { data: orders } = await supabase.from('orders').select('id,order_number').in('id', orderIds).eq('user_id', user?.id);
        orderNumbers = new Map((orders || []).map((order: any) => [String(order.id), String(order.order_number || '')]));
      }
      setCupons(coupons.map((coupon) => ({ ...coupon, sale_order_number: coupon.order_id ? orderNumbers.get(coupon.order_id) || '' : '' })));
    } catch (error: any) {
      console.error('Erro ao carregar cupons:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar cupons fiscais.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterCupons = () => {
    let filtered = cupons;

    if (searchQuery) {
      filtered = filtered.filter(cupom =>
        cupom.numero.toString().includes(searchQuery) ||
        cupom.chave_acesso?.includes(searchQuery) ||
        cupom.consumidor_nome?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cupom.consumidor_cpf_cnpj?.includes(searchQuery) ||
        cupom.sale_order_number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(cupom => cupom.status === statusFilter);
    }

    setFilteredCupons(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'autorizado': return 'bg-green-500 hover:bg-green-600';
      case 'pendente': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'rejeitado': return 'bg-red-500 hover:bg-red-600';
      case 'cancelado': return 'bg-gray-500 hover:bg-gray-600';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'autorizado': return 'Autorizado';
      case 'pendente': return 'Pendente';
      case 'rejeitado': return 'Rejeitado';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleSimulateEmission = async () => {
    setLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const randomStatus = Math.random() > 0.3 ? 'autorizado' : 'rejeitado';
    const newCupom: NFCeCupom = {
      id: Math.random().toString(36).substr(2, 9),
      numero: Math.floor(Math.random() * 10000),
      serie: '1',
      data_hora_emissao: new Date().toISOString(),
      data_hora_autorizacao: randomStatus === 'autorizado' ? new Date().toISOString() : undefined,
      valor_total: Math.floor(Math.random() * 200) + 50,
      status: randomStatus,
      chave_acesso: randomStatus === 'autorizado' ? Array(44).fill('0').map(() => Math.floor(Math.random() * 10)).join('') : undefined,
      protocolo_autorizacao: randomStatus === 'autorizado' ? Math.floor(Math.random() * 1000000000).toString() : undefined,
      motivo_rejeicao: randomStatus === 'rejeitado' ? 'Erro na validação do schema XML' : undefined,
      contingencia: false,
      consumidor_nome: 'Consumidor Simulado'
    };

    setCupons(prev => [newCupom, ...prev]);
    setLoading(false);

    toast({
      title: randomStatus === 'autorizado' ? "NFC-e Emitida (Simulação)" : "Erro na Emissão (Simulação)",
      description: randomStatus === 'autorizado' ? "A nota foi autorizada com sucesso." : "A nota foi rejeitada pela SEFAZ.",
      variant: randomStatus === 'autorizado' ? "default" : "destructive"
    });
  };

  const handleConsultarCupom = async (cupomId: string) => {
    try {
      setLoading(true);

      if (isSimulationMode) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast({
          title: "Consulta Simulada",
          description: "Status do cupom verificado com sucesso.",
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('nfce-operations', {
        body: {
          _storeId: user?.id,
          operation: 'consultar',
          cupom_id: cupomId
        }
      });

      if (error) throw error;

      toast({
        title: "Consulta realizada",
        description: "Status do cupom foi atualizado.",
      });

      loadCupons();
    } catch (error: any) {
      console.error('Erro ao consultar cupom:', error);
      toast({
        title: "Erro",
        description: "Erro ao consultar cupom na Sefaz.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendRejected = async (cupom: NFCeCupom) => {
    const confirmed = await confirm({
      title: `Reenviar ${cupom.model_code === '55' ? 'NF-e' : 'NFC-e'} rejeitada`,
      description: `O sistema consultará a chave antes e reenviará o mesmo documento nº ${cupom.numero}, sem consumir uma nova numeração.`,
      confirmText: 'Reenviar à SEFAZ',
      cancelText: 'Voltar',
    });
    if (!confirmed) return;

    setResendingCupomId(cupom.id);
    try {
      const { data, error } = await supabase.functions.invoke('nfce-operations', {
        body: { _storeId: user?.id, operation: 'reenviar_rejeitado', cupom_id: cupom.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.motivo || 'A SEFAZ rejeitou novamente o documento.');
      toast({
        title: data?.recovered ? 'Autorização recuperada' : 'Documento autorizado',
        description: data?.recovered ? 'A nota já estava autorizada na SEFAZ e o status foi corrigido.' : 'A SEFAZ autorizou o reenvio da nota.',
      });
      await loadCupons();
    } catch (error: any) {
      toast({ title: 'Não foi possível autorizar o reenvio', description: error?.message || 'Confira o motivo atualizado da rejeição.', variant: 'destructive' });
      await loadCupons();
    } finally {
      setResendingCupomId(null);
    }
  };

  const handleDownloadXML = async (cupomId: string, numero: number) => {
    try {
      if (isSimulationMode) {
        toast({
          title: "Download Simulado",
          description: "Em modo de simulação não é possível baixar o XML real.",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('nfce-operations', {
        body: {
          _storeId: user?.id,
          operation: 'download_xml',
          cupom_id: cupomId
        }
      });

      if (error) throw error;

      // Create and download file
      const blob = new Blob([data.xml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NFCe_${numero}_processada.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download concluído",
        description: "XML processado da venda autorizada foi baixado com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao baixar XML:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao baixar o XML processado da nota.",
        variant: "destructive"
      });
    }
  };

  const handleReprintCupom = async (cupom: NFCeCupom) => {
    try {
      if (!cupom.order_id) throw new Error('Este cupom não possui o pedido original vinculado.');
      setLoading(true);
      const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', cupom.order_id)
        .eq('user_id', user?.id)
        .single();
      if (error || !order) throw new Error('Pedido original não encontrado para reimpressão.');

      if (cupom.model_code === '55') {
        await PrinterService.openNfeDanfe({ ...cupom, model_code: '55' });
      } else {
        await PrinterService.printOrder({ ...order, nfce: { ...cupom, model_code: '65' } });
      }
      toast({
        title: 'Reimpressão enviada',
        description: cupom.model_code === '55'
          ? `DANFE NF-e nº ${cupom.numero} aberto em PDF A4.`
          : `DANFE NFC-e nº ${cupom.numero} enviado para impressão.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao reimprimir',
        description: error?.message || 'Não foi possível abrir ou reimprimir o DANFE.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && cupons.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="w-6 h-6" />
          Gerenciar NFC-e
        </h1>

        <div className="flex items-center gap-4 bg-secondary/20 p-2 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Switch
              id="simulation-mode"
              checked={isSimulationMode}
              onCheckedChange={setIsSimulationMode}
            />
            <Label htmlFor="simulation-mode" className="cursor-pointer font-medium">
              Modo Simulação
            </Label>
          </div>

          {isSimulationMode && (
            <Button size="sm" onClick={handleSimulateEmission} disabled={loading}>
              <PlayCircle className="w-4 h-4 mr-2" />
              Simular Emissão
            </Button>
          )}
        </div>
      </div>

      {isSimulationMode && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Ambiente de Simulação Ativo</h3>
              <p className="text-sm text-yellow-700 mt-1">
                As ações realizadas aqui não serão enviadas para a SEFAZ. Use para testar o fluxo de emissão e consulta.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por documento, venda, chave ou consumidor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="autorizado">Autorizado</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Cupons */}
      {filteredCupons.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium mb-2">Nenhum cupom encontrado</p>
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== 'all'
                ? 'Tente ajustar os filtros ou buscar por outros termos.'
                : 'Quando você emitir cupons fiscais, eles aparecerão aqui.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCupons.map((cupom) => (
            <Card key={cupom.id} className="overflow-hidden transition-all hover:shadow-md">
              <div className={`h-1 w-full ${getStatusColor(cupom.status)}`} />
              <CardHeader className="pb-3 pt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {cupom.model_code === '55' ? 'NF-e' : 'NFC-e'} #{cupom.numero}
                      <Badge variant="outline" className="font-normal text-xs">
                        Série {cupom.serie}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Emitida em {format(new Date(cupom.data_hora_emissao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {cupom.sale_order_number ? `Venda #${cupom.sale_order_number}` : 'Venda não vinculada'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={`${getStatusColor(cupom.status)} text-white border-0`}>
                      {getStatusLabel(cupom.status)}
                    </Badge>
                    {cupom.contingencia && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-yellow-50">
                        Contingência
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-secondary/10 p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Valor Total</p>
                    <p className="font-bold text-xl text-primary">{formatCurrency(cupom.valor_total)}</p>

                    {cupom.consumidor_nome && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Consumidor</p>
                        <p className="text-sm font-medium">{cupom.consumidor_nome}</p>
                        {cupom.consumidor_cpf_cnpj && (
                          <p className="text-xs text-muted-foreground">{cupom.consumidor_cpf_cnpj}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    {cupom.chave_acesso && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Chave de Acesso</p>
                        <p className="text-xs font-mono break-all bg-background p-1 rounded border">{cupom.chave_acesso}</p>
                      </div>
                    )}

                    {cupom.protocolo_autorizacao && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Protocolo</p>
                        <p className="text-sm">{cupom.protocolo_autorizacao}</p>
                      </div>
                    )}

                    {cupom.motivo_rejeicao && (
                      <div className="bg-red-50 p-2 rounded border border-red-100 mt-2">
                        <p className="text-xs text-red-800 font-semibold mb-1">Motivo da Rejeição</p>
                        <p className="text-sm text-red-600">{cupom.motivo_rejeicao}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleConsultarCupom(cupom.id)}
                    disabled={loading}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Atualizar Status
                  </Button>

                  {cupom.status === 'autorizado' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReprintCupom(cupom)}
                        disabled={loading}
                      >
                        <Printer className="w-4 h-4 mr-1" />
                        Reimprimir DANFE
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadXML(cupom.id, cupom.numero)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        XML
                      </Button>

                    </>
                  )}

                  {cupom.status === 'rejeitado' && (
                    <>
                      <Button size="sm" onClick={() => void handleResendRejected(cupom)} disabled={loading || resendingCupomId === cupom.id}>
                        {resendingCupomId === cupom.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                        {resendingCupomId === cupom.id ? 'Reenviando…' : 'Reenviar nota'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleConsultarCupom(cupom.id)} disabled={loading}>
                        <Eye className="w-4 h-4 mr-1" />
                        Ver Detalhes
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NFCeManager;
