import React from 'react';
import { MessageSquare, DollarSign, ChefHat, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const BenefitsSection = () => {
  const pains = [
    {
      id: 1,
      pain: "Clientes ignorados no WhatsApp.",
      solution: "Nosso Robô IA atende 1.000 clientes ao mesmo tempo, lembra dos pedidos antigos e manda pra cozinha.",
      icon: MessageSquare,
      color: "blue"
    },
    {
      id: 2,
      pain: "20% do lucro indo para os Apps.",
      solution: "Tenha seu link próprio de delivery. Taxa ZERO por pedido. O cliente é seu.",
      icon: DollarSign,
      color: "green"
    },
    {
      id: 3,
      pain: "Pedido de papel perdido na cozinha.",
      solution: "Tela de Cozinha (KDS) integrada. Do clique no celular direto pro chapeiro em 1 segundo.",
      icon: ChefHat,
      color: "orange"
    }
  ];

  return (
    <section className="py-24 bg-white relative" id="como-funciona">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
            Sexta-feira à noite não precisa ser um <span className="text-red-600">pesadelo</span>.
          </h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            Transformamos os maiores gargalos do seu delivery em lucro e tranquilidade.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pains.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2, duration: 0.6 }}
              viewport={{ once: true }}
              className="group relative bg-white rounded-3xl p-8 border border-slate-100 shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden"
            >
              {/* Background Decoration */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-${item.color}-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-${item.color}-500/10`}></div>

              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl bg-${item.color}-50 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300`}>
                <item.icon className={`w-7 h-7 text-${item.color}-600`} />
              </div>

              {/* Content */}
              <div className="space-y-6 relative z-10">
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-1">A Dor</p>
                  <p className="text-slate-700 font-medium">{item.pain}</p>
                </div>

                <div className="flex justify-center">
                  <ArrowRight className="w-6 h-6 text-slate-300 transform rotate-90 md:rotate-90" />
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1">A Solução PopSystem</p>
                  <p className="text-slate-800 font-semibold leading-relaxed">{item.solution}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default BenefitsSection;
