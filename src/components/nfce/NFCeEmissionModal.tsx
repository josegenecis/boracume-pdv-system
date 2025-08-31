
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Receipt, User, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Order {
  id: string;
  order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  total: number;
  items: any[];
  payment_method: string;
}

interface NFCeEmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: () => void;
}

interface ConsumerData {
  nome: string;
  cpf_cnpj: string;
  email: string;
}

const NFCeEmissionModal: React.FC<NFCeEmissionModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess
}) => {
  const [consumerData, setConsumerData] = useState<ConsumerData>({
    nome: '',
    cpf_cnpj: '',
    email: ''
  });
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fiscalSettings, setFiscalSettings] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && order) {
      // Preencher dados do consumidor se disponível
      setConsumerData({
        nome: order.customer_name || '',
        cpf_cnpj: '',
        email: ''
      });
      loadFiscalSettings();
    }
  }, [isOpen, order]);

  const loadFiscalSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('fiscal_settings')
        .select('*')
        .eq('user_id', user?.id)
        .eq('ativo', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          toast({
            title: "Configuração necessária",
            description: "Configure as informações fiscais antes de emitir cupons.",
            variant: "destructive"
          });
          onClose();
          return;
        }
        throw error;
      }

      setFiscalSettings(data);
    } catch (error: any) {
      console.error('Erro ao carregar configurações fiscais:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações fiscais.",
        variant: "destructive"
      });
      onClose();
    }
  };

  const validateCPFCNPJ = (cpfCnpj: string) => {
    const numbers = cpfCnpj.replace(/\D/g, '');
    return numbers.length === 11 || numbers.length === 14 || numbers.length === 0;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleEmitir = async () => {
    if (!order || !fiscalSettings) return;

    // Validação básica
    if (consumerData.cpf_cnpj && !validateCPFCNPJ(consumerData.cpf_cnpj)) {
      toast({
        title: "Erro",
        description: "CPF/CNPJ inválido.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Chamar edge function para emitir NFC-e
      const { data, error } = await supabase.functions.invoke('nfce-operations', {
        body: {
          operation: 'emitir',
          order_id: order.id,
          consumer_data: consumerData.nome || consumerData.cpf_cnpj ? {
            nome: consumerData.nome || null,
            cpf_cnpj: consumerData.cpf_cnpj.replace(/\D/g, '') || null,
            email: consumerData.email || null
          } : null,
          observacoes
        }
      });

      if (error) throw error;

      toast({
        title: "NFC-e emitida",
        description: `Cupom fiscal #${data.numero} emitido com sucesso.`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao emitir NFC-e:', error);
      toast({
        title: "Erro na emissão",
        description: error.message || "Erro ao emitir cupom fiscal.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Emitir NFC-e - Pedido #{order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo do Pedido */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-medium mb-3">Resumo do Pedido</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Valor Total:</span>
                  <span className="font-bold">{formatCurrency(order.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Forma de Pagamento:</span>
                  <span>{order.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span>Itens:</span>
                  <span>{order.items?.length || 0} item(s)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Consumidor */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Dados do Consumidor (Opcional)
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Consumidor</Label>
                  <Input
                    value={consumerData.nome}
                    onChange={(e) => setConsumerData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Nome completo (opcional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>CPF/CNPJ</Label>
                  <Input
                    value={consumerData.cpf_cnpj}
                    onChange={(e) => setConsumerData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00 (opcional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={consumerData.email}
                    onChange={(e) => setConsumerData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com (opcional)"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações Adicionais</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais que aparecerão no cupom fiscal (opcional)"
              rows={3}
            />
          </div>

          {/* Aviso sobre ambiente */}
          {fiscalSettings?.ambiente === 'homologacao' && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-700">
                Este cupom será emitido no ambiente de homologação (teste).
              </span>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleEmitir} disabled={loading}>
              {loading ? 'Emitindo...' : 'Emitir NFC-e'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NFCeEmissionModal;
