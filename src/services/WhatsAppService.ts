
export const WhatsAppService = {
    generateOrderMessage: (order: any) => {
        const header = `*Pedido #${order.order_number}*\n`;
        const customer = `Cliente: ${order.customer_name}\n`;
        const phone = order.customer_phone ? `Tel: ${order.customer_phone}\n` : '';
        const address = order.customer_address ? `Endereço: ${order.customer_address}\n` : '';

        let items = '\n*Itens:*\n';
        order.items.forEach((item: any) => {
            items += `${item.quantity}x ${item.name}`;
            if (item.notes) items += ` (${item.notes})`;
            items += '\n';
        });

        const total = `\n*Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}*`;
        const payment = `\nPagamento: ${order.payment_method.toUpperCase()}`;

        return encodeURIComponent(`${header}${customer}${phone}${address}${items}${total}${payment}`);
    },

    openChat: (phone: string, message: string) => {
        // Remove non-numeric characters
        const cleanPhone = phone.replace(/\D/g, '');
        // Ensure country code if missing (assuming BR +55)
        const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;

        window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');
    },

    shareOrder: (order: any) => {
        const message = WhatsAppService.generateOrderMessage(order);
        if (order.customer_phone) {
            WhatsAppService.openChat(order.customer_phone, message);
        } else {
            // If no phone, just open whatsapp with the message ready to share
            window.open(`https://wa.me/?text=${message}`, '_blank');
        }
    }
};
