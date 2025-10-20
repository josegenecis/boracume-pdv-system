<<<<<<< HEAD
import React, { useEffect } from 'react';
=======
import React from 'react';
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
<<<<<<< HEAD
  Phone, 
  MapPin, 
  Clock, 
  User, 
  CreditCard, 
  Package, 
  ExternalLink, 
  Copy,
  Truck,
  CheckCircle,
  XCircle,
  Check
=======
  Clock, 
  User, 
  Phone, 
  MapPin, 
  Package, 
  Copy, 
  ExternalLink,
  CreditCard,
  Truck,
  CheckCircle,
  XCircle
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
<<<<<<< HEAD
  total_price: number;
  options?: Array<{name: string; price: number}>;
  variations?: Array<{name: string; options: string[]}>;
=======
  total: number;
  options?: string[];
  variations?: string[];
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  notes?: string;
}

interface Order {
  id: string;
  order_number: string;
<<<<<<< HEAD
  customer_name: string;
=======
  customer_name?: string;
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  customer_phone?: string;
  customer_address?: string;
  customer_latitude?: number;
  customer_longitude?: number;
<<<<<<< HEAD
  customer_location_accuracy?: number;
  google_maps_link?: string;
  order_type: string;
  status: string;
  acceptance_status?: string;
  total: number;
  subtotal?: number;
  delivery_fee?: number;
  payment_method: string;
  items: OrderItem[];
  created_at: string;
  estimated_time?: number | string;
  delivery_instructions?: string;
  user_id?: string;
=======
  google_maps_link?: string;
  items: OrderItem[];
  total: number;
  delivery_fee?: number;
  status: string;
  acceptance_status?: string;
  payment_method: string;
  order_type: string;
  created_at: string;
  estimated_time?: string;
  delivery_instructions?: string;
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
}

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (orderId: string, newStatus: string) => void;
}

<<<<<<< HEAD
export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ 
  order, 
  isOpen, 
  onClose, 
  onStatusChange 
}) => {
  const { toast } = useToast();

  // Log detalhado quando o modal é renderizado
  useEffect(() => {
    console.log('🔍 ORDER_DETAILS_MODAL - Renderização:', {
      isOpen,
      hasOrder: !!order,
      orderId: order?.id,
      orderNumber: order?.order_number,
      timestamp: new Date().toISOString()
    });

    if (isOpen && order) {
      console.log('🔍 ORDER_DETAILS_MODAL - Dados do pedido recebidos:', {
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        status: order.status,
        items: order.items?.length || 0,
        total: order.total,
        payment_method: order.payment_method,
        created_at: order.created_at
      });
      
      console.log('🔍 ORDER_DETAILS_MODAL - Itens do pedido:', order.items);
      console.log('🔍 ORDER_DETAILS_MODAL - Estrutura completa do pedido:', JSON.stringify(order, null, 2));
    }

    if (isOpen && !order) {
      console.error('❌ ORDER_DETAILS_MODAL - Modal aberto mas sem dados do pedido!');
    }
  }, [isOpen, order]);

  // Adicionar try-catch para capturar erros de renderização
  try {
    console.log('🔍 ORDER_DETAILS_MODAL - Iniciando renderização, order:', !!order);
    
    if (!order) {
      console.log('🔍 ORDER_DETAILS_MODAL - Retornando null (sem pedido)');
      return null;
    }

    console.log('🔍 ORDER_DETAILS_MODAL - Renderizando modal com pedido:', order.order_number);

    const formatCurrency = (value: number) => {
      console.log('🔍 ORDER_DETAILS_MODAL - formatCurrency chamado com:', value);
      try {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(value);
      } catch (error) {
        console.error('❌ ORDER_DETAILS_MODAL - Erro em formatCurrency:', error);
        return `R$ ${value?.toFixed(2) || '0,00'}`;
      }
    };

    const formatDateTime = (dateString: string) => {
      console.log('🔍 ORDER_DETAILS_MODAL - formatDateTime chamado com:', dateString);
      try {
        return new Date(dateString).toLocaleString('pt-BR');
      } catch (error) {
        console.error('❌ ORDER_DETAILS_MODAL - Erro em formatDateTime:', error);
        return dateString || 'Data não disponível';
      }
    };

    const copyLocation = async () => {
      try {
        if (order.customer_latitude && order.customer_longitude) {
          const coordinates = `${order.customer_latitude},${order.customer_longitude}`;
          await navigator.clipboard.writeText(coordinates);
          toast({
            title: "Coordenadas copiadas!",
            description: "As coordenadas foram copiadas para a área de transferência.",
          });
        } else if (order.customer_address) {
          await navigator.clipboard.writeText(order.customer_address);
          toast({
            title: "Endereço copiado!",
            description: "O endereço foi copiado para a área de transferência.",
          });
        }
      } catch (error) {
        console.error('Erro ao copiar localização:', error);
        toast({
          title: "Erro ao copiar",
          description: "Não foi possível copiar a localização.",
          variant: "destructive",
        });
      }
    };

    const handleStatusUpdate = (newStatus: string) => {
      if (onStatusChange) {
        onStatusChange(order.id, newStatus);
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'pending': return <Clock className="h-3 w-3" />;
        case 'preparing': return <Package className="h-3 w-3" />;
        case 'ready': return <CheckCircle className="h-3 w-3" />;
        case 'delivered': return <Truck className="h-3 w-3" />;
        case 'cancelled': return <XCircle className="h-3 w-3" />;
        default: return <Clock className="h-3 w-3" />;
      }
    };

    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'pending': return 'Pendente';
        case 'preparing': return 'Preparando';
        case 'ready': return 'Pronto';
        case 'delivered': return 'Entregue';
        case 'cancelled': return 'Cancelado';
        default: return status;
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'preparing': return 'bg-blue-100 text-blue-800';
        case 'ready': return 'bg-green-100 text-green-800';
        case 'delivered': return 'bg-gray-100 text-gray-800';
        case 'cancelled': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Pedido {order?.order_number || 'N/A'}</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(order?.status || 'pending')}
                <Badge className={getStatusColor(order?.status || 'pending')}>
                  {getStatusLabel(order?.status || 'pending')}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Informações do Cliente */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Informações do Cliente
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Nome:</span>
                    <span>{order?.customer_name || 'Nome não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    <span className="font-medium">Telefone:</span>
                    <span>{order?.customer_phone || 'Telefone não informado'}</span>
                  </div>
                  {order?.customer_address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3 w-3 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-medium">Endereço:</span>
                        <p className="text-gray-600 mt-1">{order.customer_address}</p>
                        <div className="flex gap-2 mt-2">
                          <Button
                            onClick={copyLocation}
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copiar
                          </Button>
                          {order?.customer_latitude && order?.customer_longitude && (
                            <Button
                              onClick={() => {
                                window.open(`https://www.google.com/maps?q=${order.customer_latitude},${order.customer_longitude}`, '_blank');
                              }}
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Google Maps
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Itens do Pedido */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Itens do Pedido</h3>
                <div className="space-y-3">
                  {order?.items && Array.isArray(order.items) && order.items.length > 0 ? (
                    order.items.map((item, index) => (
                      <div key={index} className="border rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{item?.product_name || 'Produto não informado'}</h4>
                            <div className="text-xs text-gray-600 mt-1">
                              Quantidade: {item?.quantity || 0} × {formatCurrency(item?.price || 0)}
                            </div>
                          </div>
                          <div className="text-sm font-medium">
                            {formatCurrency(item?.total_price || 0)}
                          </div>
                        </div>
                        
                        {item?.options && Array.isArray(item.options) && item.options.length > 0 && (
                          <div className="text-xs">
                            <span className="font-medium text-gray-700">Variações:</span>
                            <div className="mt-1 space-y-1">
                              {item.options.map((option, oIndex) => {
                                console.log('🔍 OPTION_DEBUG - Opção completa:', option);
                                console.log('🔍 OPTION_DEBUG - Tipo da opção:', typeof option);
                                
                                // Se for string simples
                                if (typeof option === 'string') {
                                  return (
                                    <div key={oIndex} className="text-gray-600">
                                      <span>{option}</span>
                                    </div>
                                  );
                                }
                                
                                // Se for objeto com propriedades
                                if (typeof option === 'object' && option !== null) {
                                  // Tentar diferentes formatos de dados
                                  const displayName = option?.name || option?.option_name || option?.title || 'Variação';
                                  const displayValue = option?.value || option?.selected_option || option?.choice || '';
                                  const displayPrice = option?.price || option?.additional_price || 0;
                                  
                                  return (
                                    <div key={oIndex} className="text-gray-600 flex justify-between">
                                      <span>{displayName}{displayValue ? `: ${displayValue}` : ''}</span>
                                      {displayPrice > 0 && <span>+{formatCurrency(displayPrice)}</span>}
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div key={oIndex} className="text-gray-600">
                                    <span>{String(option)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {item?.notes && (
                          <div className="text-xs">
                            <span className="font-medium text-gray-700">Observações:</span>
                            <p className="text-gray-600 mt-1">{item.notes}</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      Nenhum item encontrado no pedido
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Resumo do Pedido */}
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Resumo do Pedido</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(order?.subtotal || order?.total || 0)}</span>
                  </div>
                  {order?.delivery_fee && order.delivery_fee > 0 && (
                    <div className="flex justify-between">
                      <span>Taxa de entrega:</span>
                      <span>{formatCurrency(order.delivery_fee)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total:</span>
                    <span>{formatCurrency(order?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Método de pagamento:</span>
                    <span className="font-medium">{(order?.payment_method || 'N/A').toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Informações Adicionais */}
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Informações Adicionais</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">Pedido realizado em: {formatDateTime(order?.created_at || '')}</span>
                  </div>
                  {order?.estimated_time && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">Tempo estimado: {order.estimated_time} {typeof order.estimated_time === 'number' ? 'minutos' : ''}</span>
                    </div>
                  )}
                  {order?.delivery_instructions && (
                    <div className="text-xs">
                      <span className="font-medium">Instruções de entrega:</span>
                      <p className="mt-1 text-gray-600">{order.delivery_instructions}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação */}
              {onStatusChange && order && (
                <div className="space-y-2">
                  {order.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleStatusUpdate('preparing')}
                        className="flex-1 bg-green-600 hover:bg-green-700 h-8 text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Aceitar
                      </Button>
                      <Button
                        onClick={() => handleStatusUpdate('cancelled')}
                        variant="destructive"
                        className="flex-1 h-8 text-xs"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  )}
                  
                  {order.status === 'preparing' && (
                    <Button
                      onClick={() => handleStatusUpdate('ready')}
                      className="w-full h-8 text-xs"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Marcar como Pronto
                    </Button>
                  )}
                  
                  {order.status === 'ready' && (
                    <Button
                      onClick={() => handleStatusUpdate('delivered')}
                      className="w-full bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                    >
                      <Truck className="h-3 w-3 mr-1" />
                      Finalizar Pedido
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  } catch (error) {
    console.error('❌ ORDER_DETAILS_MODAL - Erro de renderização:', error);
    
    // Retornar um modal de erro em caso de falha
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Erro ao carregar detalhes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Ocorreu um erro ao carregar os detalhes do pedido. Tente novamente.
            </p>
            <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
              Erro: {error?.message || 'Erro desconhecido'}
            </div>
            <Button onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
=======
const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
  onStatusChange
}) => {
  const { toast } = useToast();

  if (!order) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const copyLocation = async () => {
    if (order.customer_latitude && order.customer_longitude) {
      const coordinates = `${order.customer_latitude},${order.customer_longitude}`;
      await navigator.clipboard.writeText(coordinates);
      toast({
        title: "Coordenadas copiadas!",
        description: "Localização copiada para a área de transferência",
      });
    } else if (order.customer_address) {
      await navigator.clipboard.writeText(order.customer_address);
      toast({
        title: "Endereço copiado!",
        description: "Endereço copiado para a área de transferência",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'preparing':
        return <Package className="h-4 w-4 text-blue-600" />;
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'Pendente',
      preparing: 'Preparando',
      ready: 'Pronto',
      completed: 'Finalizado',
      delivered: 'Entregue',
      cancelled: 'Cancelado'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'delivery':
        return <Truck className="h-4 w-4 text-blue-600" />;
      case 'pickup':
        return <Package className="h-4 w-4 text-green-600" />;
      case 'dine_in':
        return <div className="w-4 h-4 bg-orange-600 rounded-sm" />;
      default:
        return null;
    }
  };

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case 'delivery':
        return 'Entrega';
      case 'pickup':
        return 'Retirada';
      case 'dine_in':
        return 'No Local';
      default:
        return type;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Pedido {order.order_number}</span>
            <div className="flex items-center gap-2">
              {getStatusIcon(order.status)}
              <Badge variant="outline">
                {getStatusLabel(order.status)}
              </Badge>
              <div className="flex items-center gap-1">
                {getOrderTypeIcon(order.order_type)}
                <span className="text-sm text-muted-foreground">
                  {getOrderTypeLabel(order.order_type)}
                </span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Informações do Cliente */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações do Cliente
              </h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                {order.customer_name && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Nome:</span>
                    <span>{order.customer_name}</span>
                  </div>
                )}
                
                {order.customer_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{order.customer_phone}</span>
                  </div>
                )}
                
                {order.customer_address && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <span className="flex-1">{order.customer_address}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyLocation}
                        className="h-8"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar Localização
                      </Button>
                      
                      {order.google_maps_link && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(order.google_maps_link, '_blank')}
                          className="h-8"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir no Maps
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Itens do Pedido */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Itens do Pedido ({order.items.length})
              </h3>
              
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium">
                        {item.quantity}x {item.product_name}
                      </div>
                       <div className="font-semibold">
                         {formatCurrency(item.total)}
                       </div>
                    </div>
                    
                    {item.variations && item.variations.length > 0 && (
                      <div className="ml-4 mt-1 text-sm text-blue-600">
                        <span className="font-medium">Variações:</span>
                        <span className="ml-1">{item.variations.join(', ')}</span>
                      </div>
                    )}
                    
                    {item.options && item.options.length > 0 && (
                      <div className="ml-4 mt-1 text-sm text-muted-foreground">
                        {item.options.join(', ')}
                      </div>
                    )}
                    
                    {item.notes && (
                      <div className="ml-4 mt-2 text-sm italic text-muted-foreground">
                        Obs: {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo do Pedido */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Resumo do Pedido
              </h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(order.total - (order.delivery_fee || 0))}</span>
                </div>
                
                {order.delivery_fee && order.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span>Taxa de entrega:</span>
                    <span>{formatCurrency(order.delivery_fee)}</span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
                
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Pagamento:</span>
                  <span className="font-medium">{order.payment_method.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Informações Adicionais */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Informações Adicionais
              </h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Data/Hora:</span>
                  <span>{formatDateTime(order.created_at)}</span>
                </div>
                
                {order.estimated_time && (
                  <div className="flex justify-between">
                    <span>Tempo estimado:</span>
                    <span>{order.estimated_time}</span>
                  </div>
                )}
                
                {order.delivery_instructions && (
                  <div className="space-y-1">
                    <span className="font-medium">Instruções de entrega:</span>
                    <p className="text-sm text-muted-foreground">
                      {order.delivery_instructions}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Ações */}
        {onStatusChange && order.acceptance_status === 'pending_acceptance' && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => onStatusChange(order.id, 'preparing')}
              className="flex-1"
            >
              Aceitar Pedido
            </Button>
            <Button
              variant="destructive"
              onClick={() => onStatusChange(order.id, 'cancelled')}
              className="flex-1"
            >
              Cancelar Pedido
            </Button>
          </div>
        )}
        
        {onStatusChange && ['preparing', 'ready'].includes(order.status) && (
          <div className="flex gap-2 pt-4 border-t">
            {order.status === 'preparing' && (
              <Button
                onClick={() => onStatusChange(order.id, 'ready')}
                className="flex-1"
              >
                Marcar como Pronto
              </Button>
            )}
            {order.status === 'ready' && (
              <Button
                onClick={() => onStatusChange(order.id, 'completed')}
                className="flex-1"
              >
                Finalizar Pedido
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
};

export default OrderDetailsModal;