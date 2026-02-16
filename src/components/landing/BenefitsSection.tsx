import React from 'react';
import { Star, Zap, TrendingUp, BarChart3, Clock, Shield, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const BenefitsSection = () => {
  const benefits = [
    {
      icon: Star,
      title: 'Qualidade (Quality)',
      description: 'Garanta pratos perfeitos e atendimento impecável. Elimine erros de anotação e garanta que o cliente receba exatamente o que pediu, sempre.',
      metric: 'Zero',
      metricLabel: 'Erros nos pedidos',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    {
      icon: TrendingUp,
      title: 'Quantidade (Quantity)',
      description: 'Atenda mais mesas com a mesma equipe. Nossa automação permite que seus garçons foquem no cliente, não em correr para a cozinha.',
      metric: '2x Mais',
      metricLabel: 'Giros de mesa',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      icon: Zap,
      title: 'Rapidez (Quickness)',
      description: 'Do pedido à cozinha em 1 segundo. KDS instantâneo, pagamento via PIX na mesa e fila de espera andando rápido.',
      metric: '-15 min',
      metricLabel: 'Tempo de espera',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
  ];

  return (
    <section className="py-24 bg-slate-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="text-boracume-orange font-semibold tracking-wider uppercase text-sm mb-2 block">Por que escolher o BoraCumê?</span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
            Os 3 Pilares do <span className="text-transparent bg-clip-text bg-gradient-to-r from-boracume-orange to-red-600">Sucesso</span>
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto font-light">
            Nossa metodologia exclusiva dos 3 Qs (Qualidade, Quantidade e Rapidez) transforma a gestão do seu restaurante.
          </p>
        </motion.div>

        {/* Benefícios Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              className={`group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border ${benefit.borderColor} hover:-translate-y-2`}
            >
              {/* Ícone */}
              <div className={`w-16 h-16 ${benefit.bgColor} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <benefit.icon className={`w-8 h-8 ${benefit.color}`} />
              </div>

              {/* Conteúdo */}
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                {benefit.title}
              </h3>
              <p className="text-slate-600 mb-8 leading-relaxed">
                {benefit.description}
              </p>

              {/* Métrica */}
              <div className="border-t border-slate-100 pt-6 flex items-center justify-between">
                <div>
                  <div className={`text-3xl font-bold ${benefit.color} mb-1`}>
                    {benefit.metric}
                  </div>
                  <div className="text-sm text-slate-500 font-medium uppercase tracking-wide">
                    {benefit.metricLabel}
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-full ${benefit.bgColor} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                   <Check className={`w-5 h-5 ${benefit.color}`} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Feature Grid Compact */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           {[
             { icon: BarChart3, title: "Dashboards", desc: "Visão em tempo real" },
             { icon: Clock, title: "Automação", desc: "Menos tarefas manuais" },
             { icon: Shield, title: "Segurança", desc: "Dados criptografados" },
             { icon: Star, title: "Suporte VIP", desc: "Atendimento prioritário" }
           ].map((item, idx) => (
             <motion.div
               key={idx}
               initial={{ opacity: 0, scale: 0.9 }}
               whileInView={{ opacity: 1, scale: 1 }}
               transition={{ delay: 0.4 + (idx * 0.1) }}
               viewport={{ once: true }}
               className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-boracume-orange/30 transition-colors"
             >
               <div className="bg-slate-50 p-3 rounded-xl text-slate-700">
                 <item.icon className="w-6 h-6" />
               </div>
               <div>
                 <h4 className="font-bold text-slate-900">{item.title}</h4>
                 <p className="text-sm text-slate-500">{item.desc}</p>
               </div>
             </motion.div>
           ))}
        </div>

      </div>
    </section>
  );
};

export default BenefitsSection;
