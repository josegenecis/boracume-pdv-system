import React from 'react';
import { TrendingUp, DollarSign, Heart, BarChart3, Clock, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

const BenefitsSection = () => {
  const benefits = [
    {
      icon: TrendingUp,
      title: 'Aumente vendas em 40%',
      description: 'Cardápio digital otimizado, upselling automático e análises de performance que impulsionam suas receitas.',
      metric: '+40%',
      metricLabel: 'Aumento médio em vendas',
      color: 'text-boracume-green',
      bgColor: 'bg-boracume-green/10',
    },
    {
      icon: DollarSign,
      title: 'Reduza custos operacionais',
      description: 'Automatize processos, elimine desperdícios e otimize sua operação com inteligência artificial.',
      metric: '-30%',
      metricLabel: 'Redução de custos',
      color: 'text-boracume-blue',
      bgColor: 'bg-boracume-blue/10',
    },
    {
      icon: Heart,
      title: 'Melhore experiência do cliente',
      description: 'Interface intuitiva, pedidos rápidos e acompanhamento em tempo real que encantam seus clientes.',
      metric: '4.9/5',
      metricLabel: 'Satisfação do cliente',
      color: 'text-boracume-orange',
      bgColor: 'bg-boracume-orange/10',
    },
  ];

  const additionalBenefits = [
    {
      icon: BarChart3,
      title: 'Relatórios Inteligentes',
      description: 'Dashboards em tempo real com insights acionáveis para tomada de decisões estratégicas.',
    },
    {
      icon: Clock,
      title: 'Economia de Tempo',
      description: 'Automatize tarefas repetitivas e foque no que realmente importa: seus clientes.',
    },
    {
      icon: Shield,
      title: 'Segurança Total',
      description: 'Dados protegidos com criptografia de ponta e conformidade com LGPD.',
    },
  ];

  return (
    <section className="py-20 bg-white">
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
            Por que escolher o{' '}
            <span className="text-boracume-orange">BoraCumê</span>?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Resultados comprovados que transformam restaurantes em negócios de sucesso
          </p>
        </motion.div>

        {/* Benefícios Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100"
            >
              {/* Ícone */}
              <div className={`w-16 h-16 ${benefit.bgColor} rounded-2xl flex items-center justify-center mb-6`}>
                <benefit.icon className={`w-8 h-8 ${benefit.color}`} />
              </div>

              {/* Conteúdo */}
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {benefit.title}
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                {benefit.description}
              </p>

              {/* Métrica */}
              <div className="border-t border-gray-100 pt-6">
                <div className={`text-3xl font-bold ${benefit.color} mb-1`}>
                  {benefit.metric}
                </div>
                <div className="text-sm text-gray-500">
                  {benefit.metricLabel}
                </div>
              </div>

              {/* Elemento decorativo */}
              <div className={`absolute top-4 right-4 w-20 h-20 ${benefit.bgColor} rounded-full opacity-10`}></div>
            </motion.div>
          ))}
        </div>

        {/* Benefícios Adicionais */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-gray-50 rounded-3xl p-8 md:p-12"
        >
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              E muito mais...
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Uma plataforma completa com tudo que você precisa para gerenciar seu restaurante
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {additionalBenefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <benefit.icon className="w-6 h-6 text-gray-700" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {benefit.title}
                </h4>
                <p className="text-gray-600 text-sm">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="bg-boracume-orange rounded-2xl p-8 md:p-12 text-white">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Pronto para transformar seu restaurante?
            </h3>
            <p className="text-white/80 mb-8 max-w-2xl mx-auto">
              Junte-se a mais de 1.000 restaurantes que já aumentaram suas vendas com o BoraCumê
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-boracume-orange px-8 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                Começar Teste Grátis
              </button>
              <button className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors">
                Agendar Demonstração
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BenefitsSection;