
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
    <div className="h-screen w-screen bg-[#0f172a] text-white flex flex-col overflow-hidden font-sans">
      <header className="bg-black/80 p-6 text-center border-b border-gray-800 shadow-xl z-10">
        <h1 className="text-5xl font-black tracking-widest uppercase text-yellow-400 drop-shadow-md">
          Acompanhe seu Pedido
        </h1>
      </header>

      <div className="flex-1 flex p-6 gap-6 overflow-hidden">
        {/* Preparing Column */}
        <div className="flex-1 bg-gray-900/80 rounded-3xl border-2 border-yellow-500/30 flex flex-col overflow-hidden shadow-2xl">
          <div className="bg-yellow-500 p-5 flex items-center justify-center gap-3 shadow-lg">
            <Clock className="h-8 w-8 text-black" />
            <h2 className="text-3xl font-black text-black uppercase tracking-wider">Preparando</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-1 gap-3">
              {preparing.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                   <Clock className="h-20 w-20 mb-4" />
                   <p className="text-2xl font-bold">Aguardando pedidos...</p>
                </div>
              ) : (
                preparing.map(order => (
                  <div key={order.id} className="bg-gray-800/80 p-4 rounded-xl border-l-8 border-yellow-500 flex justify-between items-center animate-fade-in shadow-md">
                    <div>
                      <span className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-0.5">Senha</span>
                      <span className="text-4xl font-black text-white tracking-widest font-mono">{getDisplayNumber(order)}</span>
                    </div>
                    <div className="text-right max-w-[50%]">
                      <span className="text-2xl text-yellow-500 font-bold truncate block">{getDisplayName(order)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Ready Column - MAIOR DESTAQUE */}
        <div className="flex-1 bg-green-900/20 rounded-3xl border-4 border-green-500 flex flex-col overflow-hidden shadow-[0_0_50px_rgba(34,197,94,0.2)]">
          <div className="bg-green-600 p-6 flex items-center justify-center gap-4 shadow-lg animate-pulse-slow">
            <CheckCircle className="h-12 w-12 text-white" />
            <h2 className="text-5xl font-black text-white uppercase tracking-widest drop-shadow-md">PRONTO</h2>
          </div>
          <div className="flex-1 p-6 overflow-y-auto scrollbar-hide bg-gradient-to-b from-green-900/10 to-transparent">
            <div className="grid grid-cols-1 gap-4">
              {ready.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-green-500/30">
                   <CheckCircle className="h-32 w-32 mb-6" />
                   <p className="text-3xl font-black uppercase">Nenhum pedido pronto</p>
                 </div>
              ) : (
                ready.map(order => (
                  <div key={order.id} className="bg-green-600 p-6 rounded-2xl shadow-2xl transform transition-all hover:scale-[1.02] border-4 border-white/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle className="h-32 w-32 text-white" />
                    </div>
                    
                    <div className="flex justify-between items-center relative z-10">
                      <div className="flex flex-col">
                        <span className="text-green-100 text-sm font-black uppercase tracking-[0.2em] mb-1 bg-green-800/30 px-2 py-1 rounded w-fit">
                            {order.order_type === 'dine_in' ? 'Levar à Mesa' : 'Retirar no Balcão'}
                        </span>
                        <span className="text-[5rem] leading-none font-black text-white tracking-tighter font-mono drop-shadow-lg">
                            {getDisplayNumber(order)}
                        </span>
                      </div>
                      <div className="text-right max-w-[50%]">
                        <span className="text-5xl text-white font-bold block truncate drop-shadow-md leading-tight">
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
      
      <footer className="p-4 text-center text-gray-500 text-sm">
        Atualizado em tempo real • BoraCumê
      </footer>
    </div>
  );
};

export default CustomerView;
