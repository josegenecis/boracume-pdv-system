
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

  return (
    <div className="h-screen w-screen bg-gray-900 text-white flex flex-col overflow-hidden font-sans">
      <header className="bg-black/50 p-6 text-center border-b border-gray-800">
        <h1 className="text-4xl font-bold tracking-widest uppercase text-yellow-500">Acompanhe seu Pedido</h1>
      </header>

      <div className="flex-1 flex p-8 gap-8">
        {/* Preparing Column */}
        <div className="flex-1 bg-gray-800/50 rounded-3xl border border-gray-700 flex flex-col overflow-hidden">
          <div className="bg-orange-600/20 p-6 border-b border-orange-600/30 flex items-center justify-center gap-4">
            <Clock className="h-10 w-10 text-orange-500" />
            <h2 className="text-3xl font-bold text-orange-500 uppercase">Preparando</h2>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-1 gap-4">
              {preparing.length === 0 ? (
                <p className="text-gray-500 text-center text-xl mt-10">A cozinha está tranquila...</p>
              ) : (
                preparing.map(order => (
                  <div key={order.id} className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex justify-between items-center animate-fade-in">
                    <div>
                      <span className="text-gray-400 text-sm block mb-1">Senha/Pedido</span>
                      <span className="text-4xl font-bold text-white tracking-wider">#{order.order_number}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl text-gray-300 font-medium">{order.customer_name.split(' ')[0]}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Ready Column */}
        <div className="flex-1 bg-green-900/20 rounded-3xl border border-green-800 flex flex-col overflow-hidden">
          <div className="bg-green-600 p-6 flex items-center justify-center gap-4 shadow-lg shadow-green-900/50">
            <CheckCircle className="h-10 w-10 text-white" />
            <h2 className="text-4xl font-black text-white uppercase tracking-wider">PRONTO</h2>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-1 gap-4">
              {ready.length === 0 ? (
                <p className="text-gray-500 text-center text-xl mt-10">Aguardando novos pedidos...</p>
              ) : (
                ready.map(order => (
                  <div key={order.id} className="bg-green-600 p-8 rounded-2xl shadow-xl transform transition-all hover:scale-105 animate-pulse-slow">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-green-100 text-sm block mb-1 font-bold uppercase">Retirar no Balcão</span>
                        <span className="text-6xl font-black text-white tracking-widest">#{order.order_number}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl text-white font-bold block">{order.customer_name.split(' ')[0]}</span>
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
