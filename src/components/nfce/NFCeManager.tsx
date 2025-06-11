
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Search, Download, Eye, X, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
}

const NFCeManager: React.FC = () => {
  const [cupons, setCupons] = useState<NFCeCupom[]>([]);
  const [filteredCupons, setFilteredCupons] = useState<NFCeCupom[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();
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
      setCupons(data || []);
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
        cupom.consumidor_cpf_cnpj?.includes(searchQuery)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(cupom => cupom.status === statusFilter);
    }

    setFilteredCupons(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'autorizado': return 'bg-green-500';
      case 'pendente': return 'bg-yellow-500';
      case 'rejeitado': return 'bg-red-500';
      case 'cancelado': return 'bg-gray-500';
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

  const handleConsultarCupom = async (cupomId: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('nfce-operations', {
        body: {
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

  const handleCancelarCupom = async (cupomId: string) => {
    if (!confirm('Tem certeza que deseja cancelar este cupom fiscal?')) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('nfce-operations', {
        body: {
          operation: 'cancelar',
          cupom_id: cupomId,
          motivo: 'Cancelamento solicitado pelo usuário'
        }
      });

      if (error) throw error;

      toast({
        title: "Cupom cancelado",
        description: "O cupom foi cancelado com sucesso.",
      });

      loadCupons();
    } catch (error: any) {
      console.error('Erro ao cancelar cupom:', error);
      toast({
        title: "Erro",
        description: "Erro ao cancelar cupom.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadXML = async (cupomId: string, numero: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('nfce-operations', {
        body: {
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
      a.download = `NFCe_${numero}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download concluído",
        description: "XML da NFC-e foi baixado com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao baixar XML:', error);
      toast({
        title: "Erro",
        description: "Erro ao baixar XML do cupom.",
        variant: "destructive"
      });
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="w-6 h-6" />
          Gerenciar NFC-e
        </h1>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por número, chave ou consumidor..."
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
            <Card key={cupom.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      NFC-e #{cupom.numero} - Série {cupom.serie}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Emitida em {format(new Date(cupom.data_hora_emissao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </p>
                    {cupom.data_hora_autorizacao && (
                      <p className="text-sm text-muted-foreground">
                        Autorizada em {format(new Date(cupom.data_hora_autorizacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={`${getStatusColor(cupom.status)} text-white`}>
                      {getStatusLabel(cupom.status)}
                    </Badge>
                    {cupom.contingencia && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        Contingência
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-lg">{formatCurrency(cupom.valor_total)}</p>
                    {cupom.consumidor_nome && (
                      <p className="text-sm text-muted-foreground">
                        Consumidor: {cupom.consumidor_nome}
                      </p>
                    )}
                    {cupom.consumidor_cpf_cnpj && (
                      <p className="text-sm text-muted-foreground">
                        CPF/CNPJ: {cupom.consumidor_cpf_cnpj}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    {cupom.chave_acesso && (
                      <p className="text-sm text-muted-foreground">
                        Chave: {cupom.chave_acesso}
                      </p>
                    )}
                    {cupom.protocolo_autorizacao && (
                      <p className="text-sm text-muted-foreground">
                        Protocolo: {cupom.protocolo_autorizacao}
                      </p>
                    )}
                    {cupom.motivo_rejeicao && (
                      <p className="text-sm text-red-600">
                        Motivo: {cupom.motivo_rejeicao}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConsultarCupom(cupom.id)}
                    disabled={loading}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Consultar
                  </Button>

                  {cupom.status === 'autorizado' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadXML(cupom.id, cupom.numero)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        XML
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelarCupom(cupom.id)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                    </>
                  )}

                  {cupom.status === 'rejeitado' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConsultarCupom(cupom.id)}
                      disabled={loading}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Detalhes
                    </Button>
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
