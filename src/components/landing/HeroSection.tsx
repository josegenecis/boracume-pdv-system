import React, { useState } from 'react';
import { Play, ArrowRight, Star, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const HeroSection = () => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const handleVideoPlay = () => {
    setIsVideoPlaying(true);
    // Aqui você pode adicionar tracking de analytics
    console.log('Video play event tracked');
  };

  return (
    <section className="relative bg-boracume-light py-20 lg:py-32 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-boracume-orange rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-boracume-green rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-boracume-blue rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Conteúdo Principal */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="inline-flex items-center space-x-2 bg-boracume-orange/10 text-boracume-orange px-4 py-2 rounded-full text-sm font-medium border border-boracume-orange/20"
            >
              <Star className="w-4 h-4" />
              <span>Mais de 1.000 restaurantes confiam no BoraCumê</span>
            </motion.div>

            {/* Título Principal */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-boracume-blue leading-tight"
            >
              Transforme seu{' '}
              <span className="text-boracume-orange">restaurante</span>{' '}
              em uma{' '}
              <span className="text-boracume-green">máquina de vendas</span>
            </motion.h1>

            {/* Subtítulo */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-xl text-boracume-gray leading-relaxed"
            >
              A plataforma completa de gestão que aumenta suas vendas em{' '}
              <strong className="text-boracume-green">40%</strong>, reduz custos operacionais e 
              melhora a experiência do cliente com tecnologia de ponta.
            </motion.p>

            {/* Estatísticas */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-wrap gap-6 text-sm"
            >
              <div className="flex items-center space-x-2 text-boracume-gray">
                <Users className="w-5 h-5 text-boracume-orange" />
                <span><strong>1.000+</strong> restaurantes</span>
              </div>
              <div className="flex items-center space-x-2 text-boracume-gray">
                <TrendingUp className="w-5 h-5 text-boracume-green" />
                <span><strong>40%</strong> aumento médio em vendas</span>
              </div>
              <div className="flex items-center space-x-2 text-boracume-gray">
                <Star className="w-5 h-5 text-boracume-orange" />
                <span><strong>4.9/5</strong> satisfação dos clientes</span>
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button 
                size="lg" 
                className="bg-boracume-orange hover:bg-boracume-orange/90 text-white px-8 py-4 text-lg font-semibold group"
              >
                Teste Grátis por 30 Dias
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-2 border-boracume-orange hover:border-boracume-orange text-boracume-orange hover:bg-boracume-orange hover:text-white px-8 py-4 text-lg font-semibold"
                onClick={() => {
                  const videoSection = document.getElementById('demo-video');
                  videoSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Play className="mr-2 w-5 h-5" />
                Ver Demonstração
              </Button>
            </motion.div>

            {/* Garantia */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="text-sm text-boracume-gray"
            >
              ✅ Sem compromisso • ✅ Cancelamento gratuito • ✅ Suporte 24/7
            </motion.p>
          </motion.div>

          {/* Vídeo Demonstrativo */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="relative"
            id="demo-video"
          >
            <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-boracume-orange/20">
              {!isVideoPlaying ? (
                <div className="relative">
                  {/* Thumbnail do vídeo */}
                  <img
                    src="https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20restaurant%20management%20dashboard%20interface%20on%20computer%20screen%20showing%20sales%20analytics%20order%20management%20and%20kitchen%20display%20professional%20clean%20design%20orange%20and%20green%20color%20scheme&image_size=landscape_16_9"
                    alt="Dashboard do BoraCumê"
                    className="w-full h-64 md:h-80 object-cover"
                  />
                  
                  {/* Play Button */}
                  <button
                    onClick={handleVideoPlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
                  >
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-boracume-orange ml-1" />
                    </div>
                  </button>

                  {/* Badge de duração */}
                  <div className="absolute bottom-4 right-4 bg-boracume-blue text-white px-3 py-1 rounded-full text-sm">
                    2:30
                  </div>
                </div>
              ) : (
                <div className="w-full h-64 md:h-80 bg-boracume-blue flex items-center justify-center">
                  <div className="text-center text-white">
                    <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Vídeo demonstrativo</p>
                    <p className="text-sm opacity-75">Em breve disponível</p>
                  </div>
                </div>
              )}
            </div>

            {/* Elementos decorativos */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-boracume-orange/20 rounded-full animate-pulse"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-boracume-green/20 rounded-full animate-pulse delay-1000"></div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;