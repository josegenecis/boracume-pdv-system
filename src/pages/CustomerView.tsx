
import React, { useMemo } from 'react';
import { useKDS } from '@/hooks/useKDS';
import { Clock, CheckCircle } from 'lucide-react';

const CustomerView = () => {
  const { orders } = useKDS();

  const { preparing, ready } = useMemo(() => {
    return {
      preparing: orders.filter(o => o.status === 'preparing'),
      ready: orders.filter(o => o.status === 'ready').slice(0, 5) // Show mostly recent ready orders
    };
  }, [orders]);

  const getDisplayName = (order: any) => {
      // Se tiver 'Mesa' no nome ou for tipo dine_in, priorizar Mesa
      if (order.order_type === 'dine_in' || order.customer_name.toLowerCase().includes('mesa')) {
          // Tenta extrair número da mesa se estiver no nome (ex: "Mesa 10")
          const mesaMatch = order.customer_name.match(/mesa\s*(\d+)/i);
          if (mesaMatch) return `MESA ${mesaMatch[1]}`;
          
          // Se for UUID longo (ex: Mesa e244...), mostra apenas "MESA"
          if (order.customer_name.length > 15 && order.customer_name.toLowerCase().includes('mesa')) {
              return "MESA";
          }
          
          return order.customer_name.length > 15 ? order.customer_name.substring(0, 15) : order.customer_name;
      }
      // Se for nome de pessoa, pega primeiro nome + inicial do segundo
      const parts = order.customer_name.split(' ');
      if (parts.length > 1) return `${parts[0]} ${parts[1][0]}.`;
      return parts[0];
  };

  const getDisplayNumber = (order: any) => {
      // Se for UUID longo, pega os últimos 4 dígitos. Se for curto, mostra tudo.
      if (order.order_number.length > 8) {
          return `#${order.order_number.slice(-4)}`;
      }
      return `#${order.order_number}`;
  };

  return (
    <div className="h-screen w-screen bg-gray-100 text-gray-900 flex flex-col overflow-hidden font-sans">
      <header className="bg-white p-6 text-center border-b border-gray-200 shadow-md z-10">
        <h1 className="text-5xl font-black tracking-widest uppercase text-gray-900 drop-shadow-sm">
          Acompanhe seu Pedido
        </h1>
      </header>

      <div className="flex-1 flex p-6 gap-6 overflow-hidden">
        {/* Preparing Column */}
        <div className="flex-1 bg-white rounded-3xl border border-gray-200 flex flex-col overflow-hidden shadow-xl">
          <div className="bg-yellow-500 p-5 flex items-center justify-center gap-3 shadow-md">
            <Clock className="h-8 w-8 text-white" />
            <h2 className="text-3xl font-black text-white uppercase tracking-wider">Preparando</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto scrollbar-hide bg-gray-50/50">
            <div className="grid grid-cols-1 gap-3">
              {preparing.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                   <Clock className="h-20 w-20 mb-4" />
                   <p className="text-2xl font-bold">Aguardando pedidos...</p>
                </div>
              ) : (
                preparing.map(order => (
                  <div key={order.id} className="bg-white p-6 rounded-xl border-l-8 border-yellow-500 flex justify-between items-center animate-fade-in shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                    <div>
                      <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-0.5">Senha</span>
                      <span className="text-5xl font-black text-gray-900 tracking-widest font-mono">{getDisplayNumber(order)}</span>
                    </div>
                    <div className="text-right max-w-[60%]">
                      <span className="text-3xl text-yellow-600 font-bold truncate block">{getDisplayName(order)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Ready Column */}
        <div className="flex-1 bg-white rounded-3xl border border-gray-200 flex flex-col overflow-hidden shadow-xl">
          <div className="bg-green-600 p-5 flex items-center justify-center gap-3 shadow-md">
            <CheckCircle className="h-8 w-8 text-white" />
            <h2 className="text-3xl font-black text-white uppercase tracking-wider">PRONTO</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto scrollbar-hide bg-gray-50/50">
            <div className="grid grid-cols-1 gap-4">
              {ready.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                   <CheckCircle className="h-20 w-20 mb-4" />
                   <p className="text-2xl font-bold uppercase">Nenhum pedido pronto</p>
                </div>
              ) : (
                ready.map(order => (
                  <div key={order.id} className="bg-green-600 p-6 rounded-2xl shadow-lg transform transition-all hover:scale-[1.01] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle className="h-24 w-24 text-white" />
                    </div>
                    
                    <div className="flex justify-between items-center relative z-10">
                      <div className="flex flex-col">
                        <span className="text-green-100 text-sm font-black uppercase tracking-[0.2em] mb-1 bg-green-800/30 px-2 py-1 rounded w-fit">
                            {order.order_type === 'dine_in' ? 'Levar à Mesa' : 'Retirar no Balcão'}
                        </span>
                        <span className="text-[5rem] leading-none font-black text-white tracking-tighter font-mono drop-shadow-md">
                            {getDisplayNumber(order)}
                        </span>
                      </div>
                      <div className="text-right max-w-[50%]">
                        <span className="text-4xl text-white font-bold block truncate drop-shadow-sm leading-tight">
                            {getDisplayName(order)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      <footer className="p-4 text-center text-gray-400 text-sm bg-gray-50 border-t border-gray-200">
        Atualizado em tempo real • BoraCumê
      </footer>
    </div>
  );
};

export default CustomerView;
