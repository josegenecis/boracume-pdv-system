import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PricingSection = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      name: 'Essencial',
      description: 'Para quem tá começando.',
      monthlyPrice: 89,
      annualPrice: 890,
      popular: false,
      features: [
        'Cardápio Digital',
        'PDV Básico',
        'Gestão de Pedidos',
        'Até 100 Produtos',
        'Suporte por Email'
      ],
      notIncluded: [
        'Robô de WhatsApp',
        'Tela de Cozinha (KDS)',
        'Gestão Financeira'
      ]
    },
    {
      name: 'Profissional',
      description: 'O favorito dos restaurantes.',
      monthlyPrice: 169,
      annualPrice: 1690,
      popular: true,
      features: [
        'Tudo do Essencial',
        'Robô de WhatsApp',
        'Tela de Cozinha (KDS)',
        'Gestão Financeira',
        'Produtos Ilimitados',
        'Suporte Prioritário'
      ],
      notIncluded: [
        'Múltiplas Lojas',
        'API de Integração'
      ]
    },
    {
      name: 'Enterprise',
      description: 'Para redes e franquias.',
      monthlyPrice: 229,
      annualPrice: 2290,
      popular: false,
      features: [
        'Tudo do Profissional',
        'Múltiplas Lojas',
        'Importação de Cardápio com IA Avançada',
        'API de Integração',
        'Gerente de Conta Dedicado'
      ],
      notIncluded: []
    }
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <section className="py-24 bg-slate-50" id="precos">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">
            Uma oferta <span className="text-boracume-orange">Irrecusável</span>.
          </h2>
          <p className="text-xl text-slate-600 mb-8">
            Comece com 30 dias grátis em qualquer plano. Sem pegadinhas.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-semibold ${!isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>Mensal</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${isAnnual ? 'bg-boracume-orange' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 ${isAnnual ? 'translate-x-8' : ''}`}></div>
            </button>
            <span className={`text-sm font-semibold ${isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>Anual (-17%)</span>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className={`relative bg-white rounded-3xl p-8 border ${
                plan.popular 
                  ? 'border-boracume-orange shadow-2xl scale-105 z-10' 
                  : 'border-slate-200 shadow-xl hover:shadow-2xl transition-shadow'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-boracume-orange text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg">
                  <Star className="w-4 h-4 fill-white" />
                  MAIS POPULAR
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-6">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">
                    {formatPrice(isAnnual ? plan.annualPrice / 12 : plan.monthlyPrice)}
                  </span>
                  <span className="text-slate-500">/mês</span>
                </div>
                {isAnnual && (
                  <p className="text-xs text-boracume-green font-semibold mt-2">
                    Cobrado anualmente: {formatPrice(plan.annualPrice)}
                  </p>
                )}
              </div>

              <div className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="text-slate-700 text-sm font-medium">{feature}</span>
                  </div>
                ))}
                {plan.notIncluded.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3 opacity-50">
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <X className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="text-slate-500 text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button 
                className={`w-full py-6 text-lg font-bold rounded-xl transition-all ${
                  plan.popular 
                    ? 'bg-boracume-orange hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30' 
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                Testar 30 Dias Grátis
              </Button>
              <p className="text-center text-xs text-slate-400 mt-4">
                Sem fidelidade. Cancele quando quiser.
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default PricingSection;
