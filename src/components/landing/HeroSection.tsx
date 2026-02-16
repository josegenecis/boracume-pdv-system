import React, { useState } from 'react';
import { Play, ArrowRight, CheckCircle2, Zap, ShieldCheck, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const HeroSection = () => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const handleVideoPlay = () => {
    setIsVideoPlaying(true);
    console.log('Video play event tracked');
  };

  return (
    <section className="relative bg-slate-900 overflow-hidden min-h-[90vh] flex items-center">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-boracume-orange/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-boracume-green/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-boracume-blue/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Left Column: Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8 text-center lg:text-left"
          >
            {/* New Badge: "Savior" Concept */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg mx-auto lg:mx-0"
            >
              <ShieldCheck className="w-4 h-4 text-boracume-green" />
              <span>O Salvador da Pátria do seu Negócio</span>
            </motion.div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight">
              Sua Cozinha no <span className="text-transparent bg-clip-text bg-gradient-to-r from-boracume-orange to-yellow-400">Ritmo Certo</span>, Seu Lucro no <span className="text-transparent bg-clip-text bg-gradient-to-r from-boracume-green to-emerald-400">Topo</span>.
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-light">
              Esqueça o caos, os pedidos perdidos e a gritaria. O BoraCumê transforma seu restaurante em uma máquina de vendas organizada, eficiente e lucrativa.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-boracume-orange to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-6 text-lg font-bold shadow-xl shadow-orange-500/20 rounded-xl transition-all hover:scale-105"
              >
                Começar Teste Grátis
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              
              <Button 
                size="lg" 
                variant="outline" 
                className="border-slate-700 bg-slate-800/50 text-white hover:bg-slate-800 hover:text-boracume-orange px-8 py-6 text-lg font-semibold backdrop-blur-sm rounded-xl transition-all"
                onClick={() => {
                  const videoSection = document.getElementById('demo-video');
                  videoSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Play className="mr-2 w-5 h-5 fill-current" />
                Ver em Ação
              </Button>
            </div>

            <div className="pt-8 flex items-center justify-center lg:justify-start gap-6 text-slate-400 text-sm font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-boracume-green" />
                <span>Instalação Imediata</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span>Suporte Ultra Rápido</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Visual / Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: 50, rotateY: 30 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ delay: 0.4, duration: 1, type: "spring" }}
            className="relative perspective-1000"
            id="demo-video"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-800/50 backdrop-blur-xl group transform hover:-translate-y-2 transition-transform duration-500">
              
              {/* Glass Reflection Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none z-20"></div>

              {!isVideoPlaying ? (
                <div className="relative aspect-video">
                  <img
                    src="https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=futuristic%20holographic%20dashboard%20interface%20floating%20in%20a%20modern%20dark%20kitchen%2C%20showing%20real-time%20sales%20graphs%20in%20neon%20green%20and%20orange%2C%20digital%20order%20tickets%2C%20sleek%20UI%20design%2C%20cyberpunk%20aesthetic%20but%20clean%2C%20professional%20software%20presentation%2C%208k%20resolution&image_size=landscape_16_9"
                    alt="Painel de Controle Futurista BoraCumê"
                    className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity duration-700"
                  />
                  
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors duration-300">
                    <button
                      onClick={handleVideoPlay}
                      className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-[0_0_30px_rgba(255,255,255,0.2)] group-hover:scale-110 transition-transform duration-300"
                    >
                      <Play className="w-10 h-10 text-white ml-1 fill-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-video bg-slate-900 flex items-center justify-center border-t border-slate-700">
                   <div className="text-center text-slate-400">
                    <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Tour do Sistema</p>
                    <p className="text-sm opacity-75">Carregando demonstração interativa...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Decorative Floating Elements */}
            <motion.div 
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 -right-10 bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-700 hidden lg:block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Faturamento Hoje</p>
                  <p className="text-lg font-bold text-white">R$ 4.250,00</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 20, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-8 -left-8 bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-700 hidden lg:block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Pedidos Entregues</p>
                  <p className="text-lg font-bold text-white">142 / 142</p>
                </div>
              </div>
            </motion.div>

          </motion.div>
        </div>
      </div>
      
      {/* Bottom Fade */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
    </section>
  );
};

export default HeroSection;
