import { buildDetailedOrderWhatsappMessage } from '@/lib/orderDetails';

export const WhatsAppService = {
  generateOrderMessage: (order: any) => buildDetailedOrderWhatsappMessage(order),

  openChat: (phone: string, message: string) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const encodedMessage = encodeURIComponent(String(message || '').trim());

    window.open(`https://wa.me/${finalPhone}?text=${encodedMessage}`, '_blank');
  },

  shareOrder: (order: any) => {
    const message = WhatsAppService.generateOrderMessage(order);
    if (order.customer_phone) {
      WhatsAppService.openChat(order.customer_phone, message);
      return;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }
};
