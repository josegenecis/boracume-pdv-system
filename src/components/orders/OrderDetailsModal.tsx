
import React, { useEffect, useState } from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 

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
  Check,
  MessageCircle,
  Printer

} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/contexts/SidebarContext';
import { PrinterService } from '@/utils/printerService';
import AdminPinDialog from '@/components/security/AdminPinDialog';
import { canCancelOrder, getLocalOperatorSession } from '@/services/operatorAuth';
import { verifyAdminPin } from '@/services/adminPin';
import { WhatsAppService } from '@/services/WhatsAppService';
import {
  formatPaymentMethodLabel,
  getOrderItemDetailGroups,
  getOrderMapsLink,
} from '@/lib/orderDetails';

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;

  total_price?: number;
  subtotal?: number;
  total?: number;
  unit_price?: number;
  options?: any[];
  variations?: any[];

  notes?: string;
}

interface Order {
  id: string;
  order_number: string;

  customer_name: string;

  customer_phone?: string;
  customer_address?: string;
  customer_latitude?: number;
  customer_longitude?: number;

  customer_location_accuracy?: number;
  google_maps_link?: string;
  order_type: string;
  status: string;
  acceptance_status?: string;
  total: number;
  subtotal?: number;
  delivery_fee?: number;
  discount?: number;
  coupon_code?: string | null;
  payment_method: string;
  items: OrderItem[];
  created_at: string;
  estimated_time?: number | string;
  delivery_instructions?: string;
  user_id?: string;
  source?: string;
  external_order_id?: string | null;
  customer_document?: string | null;
  pickup_code?: string | null;
  scheduled_at?: string | null;
  integration_payload?: any;
}

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (orderId: string, newStatus: string) => void | Promise<void>;
}


export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ 
  order, 
  isOpen, 
  onClose, 
  onStatusChange 
}) => {
  const { toast } = useToast();
  const { isMobile } = useSidebar();
  const [adminPinOpen, setAdminPinOpen] = useState(false);

  // Log detalhado quando o modal é renderizado
  useEffect(() => {
    if (isOpen && !order) return;
  }, [isOpen, order]);

  // Adicionar try-catch para capturar erros de renderização
  try {
    if (!order) {
      return null;
    }

    const toNumber = (v: any) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        let s = v.trim();
        s = s.replace(/[^0-9.,-]/g, '');
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        const decPos = Math.max(lastComma, lastDot);
        if (decPos >= 0) {
          const intPart = s.slice(0, decPos).replace(/[^0-9-]/g, '');
          const frac = s.slice(decPos + 1).replace(/[^0-9]/g, '');
          s = `${intPart}.${frac}`;
        } else {
          s = s.replace(/[^0-9-]/g, '');
        }
        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
      }
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const formatCurrency = (value: any) => {
      const n = toNumber(value);
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
    };

    const formatDateTime = (dateString: string) => {
      try {
        return new Date(dateString).toLocaleString('pt-BR');
      } catch {
        return dateString || 'Data não disponível';
      }
    };

    const itemQuantity = (item: any) => {
      const q = toNumber(item?.quantity);
      return q > 0 ? q : 1;
    };

    const itemUnitPrice = (item: any) => {
      const p = toNumber(item?.unit_price ?? item?.price);
      return p >= 0 ? p : 0;
    };

    const optionsExtra = (item: any) => {
      const opts = Array.isArray(item?.options) ? item.options : [];
      return opts.reduce((acc: number, o: any) => {
        if (!o || typeof o === 'string') return acc;
        const p = toNumber(o?.price ?? o?.additional_price);
        return acc + (p > 0 ? p : 0);
      }, 0);
    };

    const itemTotal = (item: any) => {
      const t = toNumber(item?.total_price ?? item?.subtotal ?? item?.total);
      if (t > 0) return t;
      const q = itemQuantity(item);
      const unit = itemUnitPrice(item);
      const extra = optionsExtra(item);
      return q * unit + q * extra;
    };

    const itemsSubtotal = Array.isArray(order.items)
      ? order.items.reduce((acc, it) => acc + itemTotal(it), 0)
      : 0;

    const deliveryFee = toNumber(order?.delivery_fee);
    const discountValue = Math.max(0, toNumber(order?.discount));
    const orderTotal = toNumber(order?.total);
    const orderSubtotal = toNumber(order?.subtotal);
    const subtotalValue =
      orderSubtotal > 0 ? orderSubtotal : itemsSubtotal > 0 ? itemsSubtotal : Math.max(0, orderTotal - (deliveryFee > 0 ? deliveryFee : 0));
    const totalValue = orderTotal > 0 ? orderTotal : subtotalValue + (deliveryFee > 0 ? deliveryFee : 0);
    const couponCode = String(order?.coupon_code || '').trim();
    const isLoyaltyDiscount = couponCode.startsWith('FID');
    const mapsLink = getOrderMapsLink(order);
    const ifoodData = order?.integration_payload?.ifood || {};
    const paymentBrand = String(ifoodData?.paymentSummary?.brand || '').trim();
    const paymentMethodDetail = String(ifoodData?.paymentSummary?.method || '').trim();
    const benefitsSummary = Array.isArray(ifoodData?.benefitsSummary) ? ifoodData.benefitsSummary : [];
    const customerDocument = String(order?.customer_document || '').trim();
    const pickupCode = String(order?.pickup_code || ifoodData?.pickupCode || '').trim();
    const scheduledAt = String(order?.scheduled_at || ifoodData?.deliveryDateTimeStart || '').trim();

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
      if (!onStatusChange) return;
      if (newStatus === 'cancelled') {
        const session = getLocalOperatorSession();
        if (canCancelOrder(session)) {
          onStatusChange(order.id, newStatus);
          return;
        }
        setAdminPinOpen(true);
        return;
      }
      onStatusChange(order.id, newStatus);
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'pending': return <Clock className="h-3 w-3" />;
        case 'accepted': return <Check className="h-3 w-3" />;
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
        case 'accepted': return 'Aceito (Cozinha)';
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
        case 'accepted': return 'bg-orange-100 text-orange-800';
        case 'preparing': return 'bg-blue-100 text-blue-800';
        case 'ready': return 'bg-green-100 text-green-800';
        case 'delivered': return 'bg-gray-100 text-gray-800';
        case 'cancelled': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <>
        <AdminPinDialog
          open={adminPinOpen}
          title="Cancelar pedido"
          description="Somente administrador pode cancelar. Digite o PIN do administrador."
          confirmLabel="Cancelar"
          onCancel={() => setAdminPinOpen(false)}
          onConfirm={async (pin) => {
            const restaurantUserId = order?.user_id || ''
            if (!restaurantUserId) {
              toast({ title: 'Erro', description: 'Restaurante não identificado', variant: 'destructive' })
              return
            }
            const res = await verifyAdminPin({ restaurantUserId, pin })
            if (!res.ok) {
              toast({ title: 'Sem permissão', description: 'PIN inválido ou não é administrador', variant: 'destructive' })
              return
            }
            onStatusChange?.(order.id, 'cancelled')
            setAdminPinOpen(false)
          }}
        />
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className={isMobile ? "max-h-[88vh] w-[calc(100vw-0.75rem)] max-w-none rounded-[24px] p-0" : "max-w-2xl max-h-[90vh]"}>
          <DialogHeader>
            <DialogTitle className={`flex ${isMobile ? 'flex-col items-start gap-2 px-4 pt-4' : 'items-center gap-3'}`}>
              <span>Pedido {order?.order_number || 'N/A'}</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(order?.status || 'pending')}
                <Badge className={getStatusColor(order?.status || 'pending')}>
                  {getStatusLabel(order?.status || 'pending')}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className={isMobile ? "h-7 px-2 text-[10px]" : "h-7 text-xs"}
                  onClick={() => PrinterService.printOrder(order)}
                >
                  <Printer className="h-3 w-3 mr-1" />
                  Imprimir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={isMobile ? "h-7 px-2 text-[10px]" : "h-7 text-xs"}
                  onClick={async () => {
                    try {
                      const link = `${window.location.origin}/track/${order?.id}`;
                      await navigator.clipboard.writeText(link);
                      toast({ title: 'Link copiado', description: 'Link de acompanhamento copiado.' });
                    } catch (e) {
                      toast({ title: 'Erro', description: 'Não foi possível copiar o link.', variant: 'destructive' });
                    }
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar tracking
                </Button>
                {order?.customer_phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={isMobile ? "h-7 px-2 text-[10px]" : "h-7 text-xs"}
                    onClick={() => WhatsAppService.shareOrder(order)}
                  >
                    <MessageCircle className="h-3 w-3 mr-1" />
                    WhatsApp
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className={isMobile ? "max-h-[calc(88vh-88px)] px-4 pb-4" : "max-h-[70vh] pr-4"}>
            <div className={isMobile ? "space-y-4" : "space-y-6"}>
              {/* Informações do Cliente */}
              <div className="space-y-3">
                <h3 className={`${isMobile ? 'text-[15px]' : 'text-base'} font-semibold flex items-center gap-2`}>
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
                          {mapsLink && (
                            <Button
                              onClick={() => {
                                window.open(mapsLink, '_blank');
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
                <h3 className={`${isMobile ? 'text-[15px]' : 'text-base'} font-semibold`}>Itens do Pedido</h3>
                <div className="space-y-3">
                  {order?.items && Array.isArray(order.items) && order.items.length > 0 ? (
                    order.items.map((item, index) => {
                      const detailGroups = getOrderItemDetailGroups(item);
                      const itemNotes = String(item?.notes || item?.observations || '').trim();

                      return (
                        <div key={index} className={`border space-y-2 ${isMobile ? 'rounded-[16px] p-2.5' : 'rounded-lg p-3'}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className={`font-medium ${isMobile ? 'text-[13px]' : 'text-sm'}`}>{item?.product_name || 'Produto não informado'}</h4>
                            <div className={`${isMobile ? 'text-[11px]' : 'text-xs'} text-gray-600 mt-1`}>
                              Quantidade: {itemQuantity(item)} × {formatCurrency(itemUnitPrice(item))}
                            </div>
                          </div>
                          <div className="text-sm font-medium">
                            {formatCurrency(itemTotal(item))}
                          </div>
                        </div>
                        {detailGroups.length > 0 && (
                          <div className="text-xs">
                            <span className="font-medium text-gray-700">Adicionais e complementos:</span>
                            <div className="mt-1 space-y-2">
                              {detailGroups.map((group) => (
                                <div key={group.key} className="space-y-1">
                                  {group.label ? (
                                    <div className="font-medium text-gray-700">{group.label}:</div>
                                  ) : null}
                                  {group.items.map((detail) => (
                                    <div key={detail.key} className="text-gray-600 flex justify-between gap-3">
                                      <span>{detail.text}</span>
                                      {detail.price && detail.price > 0 ? (
                                        <span className="whitespace-nowrap">+{formatCurrency(detail.price)}</span>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {false && item?.options && Array.isArray(item.options) && item.options.length > 0 && (
                          <div className="text-xs">
                            <span className="font-medium text-gray-700">Opções:</span>
                            <div className="mt-1 space-y-1">
                              {item.options.map((option, oIndex) => {
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
                                  const displayPrice = toNumber(option?.price ?? option?.additional_price);
                                  
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
                        
                        {itemNotes && (
                          <div className="text-xs">
                            <span className="font-medium text-gray-700">Observações:</span>
                            <p className="text-gray-600 mt-1">{itemNotes}</p>
                          </div>
                        )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      Nenhum item encontrado no pedido
                    </div>
                  )}
                </div>
              </div>

              {order?.delivery_instructions && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className={`${isMobile ? 'text-[15px]' : 'text-base'} font-semibold`}>OBSERVAÇÕES</h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.delivery_instructions}</p>
                  </div>
                </>
              )}

              <Separator />

              {/* Resumo do Pedido */}
              <div className="space-y-2">
                <h3 className={`${isMobile ? 'text-[15px]' : 'text-base'} font-semibold`}>Resumo do Pedido</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotalValue)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span>Taxa de entrega:</span>
                      <span>{formatCurrency(deliveryFee)}</span>
                    </div>
                  )}
                  {discountValue > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>{isLoyaltyDiscount ? 'Desconto fidelidade:' : 'Desconto:'}</span>
                      <span>- {formatCurrency(discountValue)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total:</span>
                    <span>{formatCurrency(totalValue)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Método de pagamento:</span>
                    <span className="font-medium">{formatPaymentMethodLabel(order?.payment_method, order?.acceptance_status)}</span>
                  </div>
                  {paymentBrand && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Bandeira:</span>
                      <span className="font-medium">{paymentBrand}</span>
                    </div>
                  )}
                  {paymentMethodDetail && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Tipo iFood:</span>
                      <span className="font-medium">{paymentMethodDetail}</span>
                    </div>
                  )}
                  {toNumber(order?.change_amount) > 0 && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Troco para:</span>
                      <span className="font-medium">{formatCurrency(order?.change_amount)}</span>
                    </div>
                  )}
                  {couponCode && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{isLoyaltyDiscount ? 'Código fidelidade:' : 'Cupom aplicado:'}</span>
                      <span className="font-medium">{couponCode}</span>
                    </div>
                  )}
                  {benefitsSummary.length > 0 && (
                    <div className="space-y-1 pt-1 text-xs text-gray-600">
                      <span className="font-medium">Subsídios e descontos:</span>
                      {benefitsSummary.map((benefit: any, index: number) => (
                        <div key={`${benefit?.description || 'benefit'}-${index}`} className="flex justify-between gap-3">
                          <span>{String(benefit?.description || 'Desconto iFood')}</span>
                          <span className="font-medium">- {formatCurrency(benefit?.value || 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Informações Adicionais */}
              <div className="space-y-2">
                <h3 className={`${isMobile ? 'text-[15px]' : 'text-base'} font-semibold`}>Informações Adicionais</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">Pedido realizado em: {formatDateTime(order?.created_at || '')}</span>
                  </div>
                  {order?.source === 'ifood' && (
                    <div className="flex items-center gap-2">
                      <Package className="h-3 w-3" />
                      <span className="text-xs">Canal: iFood {order?.external_order_id ? `· ID ${order.external_order_id}` : ''}</span>
                    </div>
                  )}
                  {customerDocument && (
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span className="text-xs">CPF/CNPJ para fiscal: {customerDocument}</span>
                    </div>
                  )}
                  {pickupCode && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3" />
                      <span className="text-xs">Código de coleta: {pickupCode}</span>
                    </div>
                  )}
                  {scheduledAt && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">Agendado para: {formatDateTime(scheduledAt)}</span>
                    </div>
                  )}
                  {order?.estimated_time && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">Tempo estimado: {order.estimated_time} {typeof order.estimated_time === 'number' ? 'minutos' : ''}</span>
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
                        className={isMobile ? "flex-1 h-10 bg-green-600 text-sm hover:bg-green-700" : "flex-1 bg-green-600 hover:bg-green-700 h-8 text-xs"}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Aceitar
                      </Button>
                      <Button
                        onClick={() => handleStatusUpdate('cancelled')}
                        variant="destructive"
                        className={isMobile ? "flex-1 h-10 text-sm" : "flex-1 h-8 text-xs"}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  )}
                  
                  {order.status === 'preparing' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleStatusUpdate('ready')}
                        className={isMobile ? "h-10 flex-1 text-sm" : "flex-1 h-8 text-xs"}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Marcar como Pronto
                      </Button>
                      <Button
                        onClick={() => handleStatusUpdate('cancelled')}
                        variant="destructive"
                        className={isMobile ? "h-10 flex-1 text-sm" : "flex-1 h-8 text-xs"}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  )}
                  
                  {order.status === 'ready' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleStatusUpdate('delivered')}
                        className={isMobile ? "h-10 flex-1 bg-blue-600 text-sm hover:bg-blue-700" : "flex-1 bg-blue-600 hover:bg-blue-700 h-8 text-xs"}
                      >
                        <Truck className="h-3 w-3 mr-1" />
                        Finalizar Pedido
                      </Button>
                      <Button
                        onClick={() => handleStatusUpdate('cancelled')}
                        variant="destructive"
                        className={isMobile ? "h-10 flex-1 text-sm" : "flex-1 h-8 text-xs"}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          </DialogContent>
        </Dialog>
      </>
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

};

export default OrderDetailsModal;
