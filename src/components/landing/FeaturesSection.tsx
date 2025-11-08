import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Smartphone, 
  BarChart3, 
  CreditCard, 
  Users, 
  Clock, 
  Shield,
  Zap,
  MessageSquare,
  Package,
  TrendingUp,
  Settings,
  Globe,
  ChevronRight,
  Play
} from 'lucide-react';

const FeaturesSection = () => {
  const [activeTab, setActiveTab] = useState('cardapio');

  const mainFeatures = [
    {
      id: 'cardapio',
      icon: Smartphone,
      title: 'Cardápio Digital Inteligente',
      description: 'Cardápio responsivo com fotos, descrições detalhadas e sugestões automáticas de upselling.',
      image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20digital%20menu%20on%20tablet%20in%20restaurant%20setting%20with%20food%20photos%20and%20prices&image_size=landscape_4_3',
      benefits: [
        'Interface intuitiva e responsiva',
        'Fotos em alta qualidade dos pratos',
        'Sugestões automáticas de acompanhamentos',
        'Atualização em tempo real de disponibilidade'
      ]
    },
    {
      id: 'gestao',
      icon: BarChart3,
      title: 'Gestão Completa',
      description: 'Dashboard com relatórios em tempo real, controle de estoque e análise de performance.',
      image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=restaurant%20management%20dashboard%20with%20charts%20graphs%20and%20analytics%20on%20computer%20screen&image_size=landscape_4_3',
      benefits: [
        'Relatórios detalhados de vendas',
        'Controle de estoque automatizado',
        'Análise de pratos mais vendidos',
        'Previsão de demanda com IA'
      ]
    },
    {
      id: 'pagamentos',
      icon: CreditCard,
      title: 'Pagamentos Integrados',
      description: 'Aceite todos os tipos de pagamento com segurança e praticidade total.',
      image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=contactless%20payment%20system%20with%20credit%20card%20and%20mobile%20payment%20in%20restaurant&image_size=landscape_4_3',
      benefits: [
        'PIX, cartão e dinheiro',
        'Pagamento sem contato',
        'Divisão de conta automática',
        'Integração com principais adquirentes'
      ]
    },
    {
      id: 'atendimento',
      icon: Users,
      title: 'Atendimento Otimizado',
      description: 'Sistema de comandas digitais e comunicação direta entre cozinha e salão.',
      image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=restaurant%20staff%20using%20tablets%20for%20order%20management%20and%20kitchen%20communication&image_size=landscape_4_3',
      benefits: [
        'Comandas digitais em tempo real',
        'Comunicação cozinha-salão',
        'Controle de mesas e pedidos',
        'Notificações automáticas'
      ]
    }
  ];

  const additionalFeatures = [
    {
      icon: Clock,
      title: 'Delivery Integrado',
      description: 'Gerencie pedidos de delivery e balcão em uma única plataforma.',
      color: 'text-boracume-orange',
      bgColor: 'bg-boracume-orange/10'
    },
    {
      icon: Shield,
      title: 'Segurança Total',
      description: 'Dados protegidos com criptografia e backup automático.',
      color: 'text-boracume-green',
      bgColor: 'bg-boracume-green/10'
    },
    {
      icon: Zap,
      title: 'Performance Rápida',
      description: 'Sistema otimizado para alta velocidade mesmo em horários de pico.',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    {
      icon: MessageSquare,
      title: 'Suporte 24/7',
      description: 'Atendimento especializado disponível a qualquer momento.',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      icon: Package,
      title: 'Controle de Estoque',
      description: 'Monitore ingredientes e receba alertas de reposição.',
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      icon: TrendingUp,
      title: 'Analytics Avançado',
      description: 'Insights detalhados para otimizar seu negócio.',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    },
    {
      icon: Settings,
      title: 'Personalização Total',
      description: 'Adapte o sistema às necessidades do seu restaurante.',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    },
    {
      icon: Globe,
      title: 'Multi-idiomas',
      description: 'Suporte a múltiplos idiomas para atender turistas.',
      color: 'text-teal-600',
      bgColor: 'bg-teal-100'
    }
  ];

  return (
    <section className="py-20 bg-white" id="funcionalidades">
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
            Funcionalidades que fazem a{' '}
            <span className="text-boracume-orange">diferença</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Tudo que você precisa para gerenciar seu restaurante de forma eficiente e moderna
          </p>
        </motion.div>

        {/* Funcionalidades Principais com Tabs */}
        <div className="mb-20">
          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center mb-12 bg-gray-100 rounded-2xl p-2 max-w-4xl mx-auto">
            {mainFeatures.map((feature) => (
              <button
                key={feature.id}
                onClick={() => setActiveTab(feature.id)}
                className={`flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  activeTab === feature.id
                    ? 'bg-white text-boracume-orange shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <feature.icon className="w-5 h-5 mr-2" />
                <span className="hidden sm:inline">{feature.title}</span>
                <span className="sm:hidden">{feature.title.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="max-w-6xl mx-auto">
            {mainFeatures.map((feature) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: activeTab === feature.id ? 1 : 0,
                  y: activeTab === feature.id ? 0 : 20
                }}
                transition={{ duration: 0.5 }}
                className={`${activeTab === feature.id ? 'block' : 'hidden'}`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  {/* Conteúdo */}
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-boracume-orange/10 rounded-2xl flex items-center justify-center">
              <feature.icon className="w-8 h-8 text-boracume-orange" />
                      </div>
                      <div>
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
                          {feature.title}
                        </h3>
                      </div>
                    </div>
                    
                    <p className="text-lg text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>

                    <ul className="space-y-3">
                      {feature.benefits.map((benefit, index) => (
                        <li key={index} className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-boracume-green/10 rounded-full flex items-center justify-center flex-shrink-0">
                <ChevronRight className="w-4 h-4 text-boracume-green" />
                          </div>
                          <span className="text-gray-700">{benefit}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button className="bg-boracume-orange text-white px-6 py-3 rounded-xl font-semibold hover:bg-boracume-orange/90 transition-colors flex items-center justify-center">
                        <Play className="w-5 h-5 mr-2" />
                        Ver Demonstração
                      </button>
                      <button className="border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-boracume-orange hover:text-boracume-orange transition-colors flex items-center justify-center">
                        Saiba Mais
                      </button>
                    </div>
                  </div>

                  {/* Imagem */}
                  <div className="relative">
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                      <img
                        src={feature.image}
                        alt={feature.title}
                        className="w-full h-80 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    </div>
                    
                    {/* Elemento decorativo */}
                    <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-100 rounded-full opacity-20"></div>
                    <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-green-100 rounded-full opacity-20"></div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Grid de Funcionalidades Adicionais */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              E muito mais funcionalidades
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Uma plataforma completa com todas as ferramentas que seu restaurante precisa
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {additionalFeatures.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow duration-300 group"
              >
                <div className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h4>
                <p className="text-gray-600 text-sm">
                  {feature.description}
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
          className="text-center bg-gradient-to-r from-blue-50 to-green-50 rounded-3xl p-8 md:p-12"
        >
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Pronto para revolucionar seu restaurante?
          </h3>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Teste todas essas funcionalidades gratuitamente por 14 dias. 
            Sem compromisso, sem cartão de crédito.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300">
              Começar Teste Grátis
            </button>
            <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-semibold hover:border-gray-400 transition-colors">
              Ver Todas as Funcionalidades
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;