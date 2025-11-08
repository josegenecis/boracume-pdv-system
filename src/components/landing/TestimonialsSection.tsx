import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  Quote, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  Users, 
  Clock,
  Award,
  Play
} from 'lucide-react';

const TestimonialsSection = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const testimonials = [
    {
      id: 1,
      name: 'Carlos Silva',
      position: 'Proprietário',
      restaurant: 'Restaurante Sabor Mineiro',
      location: 'Belo Horizonte, MG',
      avatar: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20restaurant%20owner%20middle%20aged%20man%20smiling%20portrait&image_size=square',
      rating: 5,
      quote: 'O BoraCumê transformou completamente nosso restaurante. Em 3 meses, nossas vendas aumentaram 45% e conseguimos reduzir os custos operacionais significativamente. A equipe se adaptou rapidamente e os clientes adoraram o novo sistema.',
      metrics: {
        salesIncrease: 45,
        costReduction: 30,
        timeframe: '3 meses'
      },
      videoThumbnail: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=restaurant%20interior%20with%20digital%20menu%20tablets%20on%20tables%20modern%20atmosphere&image_size=landscape_16_9'
    },
    {
      id: 2,
      name: 'Ana Beatriz Costa',
      position: 'Gerente Geral',
      restaurant: 'Bistrô da Vila',
      location: 'São Paulo, SP',
      avatar: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20restaurant%20manager%20woman%20confident%20smile%20portrait&image_size=square',
      rating: 5,
      quote: 'Impressionante como o sistema é intuitivo! Nossos garçons aprenderam em poucos dias e a experiência do cliente melhorou drasticamente. Os relatórios nos ajudam a tomar decisões mais assertivas diariamente.',
      metrics: {
        salesIncrease: 38,
        costReduction: 25,
        timeframe: '2 meses'
      },
      videoThumbnail: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=elegant%20bistro%20interior%20with%20staff%20using%20tablets%20for%20orders&image_size=landscape_16_9'
    },
    {
      id: 3,
      name: 'Roberto Fernandes',
      position: 'Chef e Proprietário',
      restaurant: 'Casa do Bacalhau',
      location: 'Rio de Janeiro, RJ',
      avatar: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20chef%20restaurant%20owner%20mature%20man%20confident%20portrait&image_size=square',
      rating: 5,
      quote: 'Como chef, sempre me preocupei mais com a cozinha do que com a gestão. O BoraCumê me deu controle total do negócio sem complicar minha rotina. Agora sei exatamente quais pratos vendem mais e posso otimizar meu cardápio.',
      metrics: {
        salesIncrease: 52,
        costReduction: 35,
        timeframe: '4 meses'
      },
      videoThumbnail: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=traditional%20restaurant%20kitchen%20with%20chef%20using%20digital%20system&image_size=landscape_16_9'
    },
    {
      id: 4,
      name: 'Mariana Oliveira',
      position: 'Sócia-Proprietária',
      restaurant: 'Pizzaria Nonna',
      location: 'Curitiba, PR',
      avatar: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=young%20female%20restaurant%20owner%20entrepreneur%20confident%20smile&image_size=square',
      rating: 5,
      quote: 'Tínhamos dificuldades com o controle de pedidos nos fins de semana. Agora, mesmo nos dias mais movimentados, tudo flui perfeitamente. O delivery integrado foi um diferencial que nos ajudou muito durante a pandemia.',
      metrics: {
        salesIncrease: 41,
        costReduction: 28,
        timeframe: '3 meses'
      },
      videoThumbnail: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=busy%20pizzeria%20with%20digital%20ordering%20system%20and%20happy%20customers&image_size=landscape_16_9'
    }
  ];

  const stats = [
    {
      icon: TrendingUp,
      value: '1000+',
      label: 'Restaurantes Ativos',
      color: 'text-blue-600'
    },
    {
      icon: Users,
      value: '4.9/5',
      label: 'Satisfação do Cliente',
      color: 'text-green-600'
    },
    {
      icon: Clock,
      value: '24/7',
      label: 'Suporte Técnico',
      color: 'text-purple-600'
    },
    {
      icon: Award,
      value: '99.9%',
      label: 'Uptime Garantido',
      color: 'text-orange-500'
    }
  ];

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => 
        prev === testimonials.length - 1 ? 0 : prev + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, testimonials.length]);

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => 
      prev === testimonials.length - 1 ? 0 : prev + 1
    );
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => 
      prev === 0 ? testimonials.length - 1 : prev - 1
    );
  };

  const currentData = testimonials[currentTestimonial];

  return (
    <section className="py-20 bg-white" id="depoimentos">
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
            Histórias de{' '}
            <span className="text-blue-600">sucesso</span> reais
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Veja como restaurantes como o seu estão transformando seus negócios com o BoraCumê
          </p>
        </motion.div>

        {/* Estatísticas */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16"
        >
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
              <div className={`text-2xl md:text-3xl font-bold ${stat.color} mb-1`}>
                {stat.value}
              </div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Depoimento Principal */}
        <div className="max-w-6xl mx-auto">
          <div 
            className="relative bg-gradient-to-br from-blue-50 to-green-50 rounded-3xl p-8 md:p-12 mb-8"
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
          >
            {/* Controles de Navegação */}
            <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 flex justify-between pointer-events-none">
              <button
                onClick={prevTestimonial}
                className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow pointer-events-auto"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <button
                onClick={nextTestimonial}
                className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow pointer-events-auto"
              >
                <ChevronRight className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
              >
                {/* Conteúdo do Depoimento */}
                <div className="space-y-6">
                  {/* Quote Icon */}
                  <Quote className="w-12 h-12 text-blue-600 opacity-50" />
                  
                  {/* Rating */}
                  <div className="flex items-center space-x-1">
                    {[...Array(currentData.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>

                  {/* Depoimento */}
                  <blockquote className="text-lg md:text-xl text-gray-700 leading-relaxed">
                    "{currentData.quote}"
                  </blockquote>

                  {/* Métricas */}
                  <div className="grid grid-cols-3 gap-4 py-6 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        +{currentData.metrics.salesIncrease}%
                      </div>
                      <div className="text-sm text-gray-600">Vendas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        -{currentData.metrics.costReduction}%
                      </div>
                      <div className="text-sm text-gray-600">Custos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {currentData.metrics.timeframe}
                      </div>
                      <div className="text-sm text-gray-600">Prazo</div>
                    </div>
                  </div>

                  {/* Autor */}
                  <div className="flex items-center space-x-4">
                    <img
                      src={currentData.avatar}
                      alt={currentData.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">
                        {currentData.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {currentData.position}
                      </div>
                      <div className="text-sm font-medium text-blue-600">
                        {currentData.restaurant}
                      </div>
                      <div className="text-xs text-gray-500">
                        {currentData.location}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vídeo/Imagem */}
                <div className="relative">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                    <img
                      src={currentData.videoThumbnail}
                      alt={`${currentData.restaurant} - Case de sucesso`}
                      className="w-full h-80 object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                      <button className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-blue-600 ml-1" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Badge do Restaurante */}
                  <div className="absolute -bottom-4 left-4 right-4">
                    <div className="bg-white rounded-xl p-4 shadow-lg">
                      <div className="text-center">
                        <div className="font-semibold text-gray-900">
                          {currentData.restaurant}
                        </div>
                        <div className="text-sm text-gray-600">
                          {currentData.location}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Indicadores */}
            <div className="flex justify-center space-x-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentTestimonial ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Grid de Depoimentos Menores */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16"
        >
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <div key={testimonial.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              {/* Rating */}
              <div className="flex items-center space-x-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                ))}
              </div>

              {/* Quote resumida */}
              <p className="text-gray-700 mb-4 line-clamp-3">
                "{testimonial.quote.substring(0, 120)}..."
              </p>

              {/* Autor */}
              <div className="flex items-center space-x-3">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <div className="font-medium text-gray-900 text-sm">
                    {testimonial.name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {testimonial.restaurant}
                  </div>
                </div>
              </div>

              {/* Métrica destacada */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    +{testimonial.metrics.salesIncrease}% vendas
                  </div>
                  <div className="text-xs text-gray-500">
                    em {testimonial.metrics.timeframe}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* CTA Final */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl p-8 md:p-12 text-white">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Seja o próximo caso de sucesso
            </h3>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              Junte-se a mais de 1.000 restaurantes que já transformaram seus negócios com o BoraCumê
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                Começar Teste Grátis
              </button>
              <button className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors">
                Ver Mais Cases
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;