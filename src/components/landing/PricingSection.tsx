import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  X, 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Crown,
  Zap,
  Star,
  ArrowRight
} from 'lucide-react';

const PricingSection = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [roiData, setRoiData] = useState({
    monthlyRevenue: 50000,
    currentCosts: 15000,
    tables: 20
  });
  const [roiResults, setRoiResults] = useState({
    monthlySavings: 0,
    annualSavings: 0,
    revenueIncrease: 0,
    paybackMonths: 0
  });

  const plans = [
    {
      name: 'Starter',
      description: 'Perfeito para restaurantes pequenos',
      monthlyPrice: 199,
      annualPrice: 1990,
      icon: Users,
      color: 'boracume-blue',
      popular: false,
      features: [
        'Até 10 mesas',
        'Cardápio digital básico',
        'Relatórios essenciais',
        'Suporte por email',
        'Integração PIX',
        'App mobile básico'
      ],
      notIncluded: [
        'Analytics avançado',
        'Integração delivery',
        'Suporte 24/7',
        'Personalização avançada'
      ]
    },
    {
      name: 'Professional',
      description: 'Ideal para restaurantes em crescimento',
      monthlyPrice: 399,
      annualPrice: 3990,
      icon: TrendingUp,
      color: 'boracume-green',
      popular: true,
      features: [
        'Até 30 mesas',
        'Cardápio digital completo',
        'Analytics avançado',
        'Suporte prioritário',
        'Todas as integrações de pagamento',
        'Delivery integrado',
        'Controle de estoque',
        'Relatórios personalizados'
      ],
      notIncluded: [
        'Suporte 24/7',
        'Personalização total'
      ]
    },
    {
      name: 'Enterprise',
      description: 'Para redes e grandes restaurantes',
      monthlyPrice: 799,
      annualPrice: 7990,
      icon: Crown,
      color: 'boracume-orange',
      popular: false,
      features: [
        'Mesas ilimitadas',
        'Todas as funcionalidades',
        'Suporte 24/7 dedicado',
        'Personalização total',
        'API completa',
        'Treinamento presencial',
        'Gerente de conta dedicado',
        'Relatórios executivos',
        'Integração ERP',
        'Multi-unidades'
      ],
      notIncluded: []
    }
  ];

  // Calcular ROI
  useEffect(() => {
    const planPrice = 399; // Professional plan
    const revenueIncrease = roiData.monthlyRevenue * 0.4; // 40% increase
    const costReduction = roiData.currentCosts * 0.3; // 30% cost reduction
    const monthlySavings = revenueIncrease + costReduction - planPrice;
    const annualSavings = monthlySavings * 12;
    const paybackMonths = planPrice / (revenueIncrease + costReduction);

    setRoiResults({
      monthlySavings,
      annualSavings,
      revenueIncrease,
      paybackMonths: Math.max(1, Math.ceil(paybackMonths))
    });
  }, [roiData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getColorClasses = (color: string, type: 'bg' | 'text' | 'border') => {
    const colors = {
      'boracume-blue': {
        bg: 'bg-boracume-blue',
        text: 'text-boracume-blue',
        border: 'border-boracume-blue'
      },
      'boracume-green': {
        bg: 'bg-boracume-green',
        text: 'text-boracume-green',
        border: 'border-boracume-green'
      },
      'boracume-orange': {
        bg: 'bg-boracume-orange',
        text: 'text-boracume-orange',
        border: 'border-boracume-orange'
      }
    };
    return colors[color as keyof typeof colors][type];
  };

  return (
    <section className="py-20 bg-gray-50" id="precos">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Planos que se adaptam ao seu{' '}
            <span className="text-boracume-orange">negócio</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Escolha o plano ideal para o seu restaurante e comece a ver resultados imediatamente
          </p>

          {/* Toggle Anual/Mensal */}
          <div className="flex items-center justify-center space-x-4">
            <span className={`font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>
              Mensal
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                isAnnual ? 'bg-boracume-green' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  isAnnual ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>
              Anual
            </span>
            {isAnnual && (
              <span className="bg-boracume-green/10 text-boracume-green px-3 py-1 rounded-full text-sm font-medium">
                Economize 17%
              </span>
            )}
          </div>
        </motion.div>

        {/* Planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              viewport={{ once: true }}
              className={`relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 ${
                plan.popular ? 'ring-2 ring-boracume-green scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-boracume-green text-white px-4 py-2 rounded-full text-sm font-medium flex items-center">
                    <Star className="w-4 h-4 mr-1" />
                    Mais Popular
                  </div>
                </div>
              )}

              {/* Header do Plano */}
              <div className="text-center mb-8">
                <div className={`w-16 h-16 ${getColorClasses(plan.color, 'bg')} bg-opacity-10 rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <plan.icon className={`w-8 h-8 ${getColorClasses(plan.color, 'text')}`} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 mb-4">{plan.description}</p>
                
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatCurrency(isAnnual ? plan.annualPrice / 12 : plan.monthlyPrice)}
                  </span>
                  <span className="text-gray-600">/mês</span>
                </div>
                
                {isAnnual && (
                  <p className="text-sm text-gray-500">
                    Cobrado anualmente: {formatCurrency(plan.annualPrice)}
                  </p>
                )}
              </div>

              {/* Funcionalidades */}
              <div className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-boracume-green flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
                {plan.notIncluded.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-center space-x-3 opacity-50">
                    <X className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-500">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 ${
                  plan.popular
                    ? 'bg-boracume-green text-white hover:bg-boracume-green/90'
                    : `border-2 ${getColorClasses(plan.color, 'border')} ${getColorClasses(plan.color, 'text')} hover:bg-opacity-10 hover:${getColorClasses(plan.color, 'bg')}`
                }`}
              >
                {plan.popular ? 'Começar Agora' : 'Escolher Plano'}
              </button>

              {plan.name === 'Professional' && (
                <p className="text-center text-sm text-gray-500 mt-3">
                  14 dias grátis • Sem cartão de crédito
                </p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Calculadora de ROI */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-white rounded-3xl p-8 md:p-12 shadow-lg"
        >
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-boracume-orange/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calculator className="w-8 h-8 text-boracume-orange" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Calculadora de ROI
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Descubra quanto você pode economizar e ganhar com o BoraCumê
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Inputs */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Faturamento mensal atual
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={roiData.monthlyRevenue}
                    onChange={(e) => setRoiData({...roiData, monthlyRevenue: Number(e.target.value)})}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-boracume-orange focus:border-transparent"
                    placeholder="50000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custos operacionais mensais
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={roiData.currentCosts}
                    onChange={(e) => setRoiData({...roiData, currentCosts: Number(e.target.value)})}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-boracume-orange focus:border-transparent"
                    placeholder="15000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de mesas
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={roiData.tables}
                    onChange={(e) => setRoiData({...roiData, tables: Number(e.target.value)})}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-boracume-orange focus:border-transparent"
                    placeholder="20"
                  />
                </div>
              </div>
            </div>

            {/* Resultados */}
            <div className="bg-boracume-light rounded-2xl p-6">
              <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <TrendingUp className="w-6 h-6 text-boracume-green mr-2" />
                Seus Resultados Projetados
              </h4>

              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-1">Aumento de receita mensal</div>
                  <div className="text-2xl font-bold text-boracume-green">
                    {formatCurrency(roiResults.revenueIncrease)}
                  </div>
                  <div className="text-xs text-gray-500">+40% em média</div>
                </div>

                <div className="bg-white rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-1">Economia mensal líquida</div>
                  <div className="text-2xl font-bold text-boracume-blue">
                    {formatCurrency(roiResults.monthlySavings)}
                  </div>
                  <div className="text-xs text-gray-500">Após descontar o plano</div>
                </div>

                <div className="bg-white rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-1">Retorno anual</div>
                  <div className="text-2xl font-bold text-boracume-gray">
                    {formatCurrency(roiResults.annualSavings)}
                  </div>
                  <div className="text-xs text-gray-500">Em 12 meses</div>
                </div>

                <div className="bg-white rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-1">Payback</div>
                  <div className="text-2xl font-bold text-boracume-orange">
                    {roiResults.paybackMonths} {roiResults.paybackMonths === 1 ? 'mês' : 'meses'}
                  </div>
                  <div className="text-xs text-gray-500">Tempo para recuperar investimento</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <button className="w-full bg-boracume-orange text-white py-3 rounded-xl font-semibold hover:bg-boracume-orange/90 transition-all duration-300 flex items-center justify-center">
                  Começar Teste Grátis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </button>
                <p className="text-center text-xs text-gray-500 mt-2">
                  * Resultados baseados na média dos nossos clientes
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* FAQ Rápido */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-8">
            Perguntas Frequentes sobre Preços
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2">Posso trocar de plano?</h4>
              <p className="text-sm text-gray-600">
                Sim! Você pode fazer upgrade ou downgrade a qualquer momento.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2">Há taxa de setup?</h4>
              <p className="text-sm text-gray-600">
                Não cobramos taxa de instalação ou configuração inicial.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2">Posso cancelar quando quiser?</h4>
              <p className="text-sm text-gray-600">
                Sim, sem multas ou taxas de cancelamento. Seus dados ficam seguros.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;