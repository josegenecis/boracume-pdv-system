import React from 'react';
import { ArrowRight, Check, Play, Smartphone, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const HeroSection = () => {
  return (
    <section className="relative bg-slate-950 overflow-hidden min-h-[90vh] flex items-center pt-20">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1556740758-90de374c12ad?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80" 
          alt="Atendente usando sistema PDV em restaurante" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/80"></div>
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Noise Texture */}
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-soft-light"></div>
        
        {/* Gradient Orbs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-boracume-orange/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-boracume-green/10 rounded-full blur-[100px] animate-pulse delay-2000"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Left Column: Copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8 text-center lg:text-left"
          >
            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center space-x-2 bg-slate-900/50 border border-slate-800 backdrop-blur-md px-4 py-2 rounded-full"
            >
              <span className="text-xl">🚀</span>
              <span className="text-sm font-semibold text-slate-300 tracking-wide uppercase">O Fim das Taxas Abusivas de Delivery</span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">
              Liberte seu restaurante do caos no WhatsApp e pare de dar seu lucro para o <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-600">iFood</span>.
            </h1>

            {/* Sub-headline */}
            <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-light border-l-4 border-boracume-orange pl-6">
              O único sistema de Delivery e PDV com <span className="text-white font-medium">Inteligência Artificial</span> que lê a foto do seu cardápio de papel e cria sua loja digital em menos de 1 minuto.
            </p>

            {/* CTA Area */}
            <div className="flex flex-col items-center lg:items-start space-y-4">
              <Link to="/login?tab=register" className="w-full sm:w-auto">
                <Button 
                  size="lg" 
                  className="w-full bg-boracume-orange hover:bg-orange-600 text-white text-lg font-bold px-8 py-8 rounded-2xl shadow-[0_0_40px_-10px_rgba(234,88,12,0.6)] animate-pulse hover:animate-none transition-all transform hover:scale-105 border-t border-white/20"
                >
                  <div className="flex flex-col items-center sm:items-start">
                    <span className="flex items-center gap-2">
                      Importar meu Cardápio com IA <span className="bg-white/20 text-xs px-2 py-0.5 rounded uppercase">Grátis</span>
                    </span>
                  </div>
                  <ArrowRight className="ml-3 w-6 h-6" />
                </Button>
              </Link>
              
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 text-sm text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-boracume-green" />
                  <span>Sem cartão de crédito</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-boracume-green" />
                  <span>Teste completo por 30 dias</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Visual Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30, rotateY: 10 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="relative lg:h-[600px] flex items-center justify-center"
          >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-boracume-orange/20 to-blue-600/20 rounded-full blur-[80px] opacity-60"></div>

            <div className="relative w-full max-w-lg mx-auto perspective-1000">
              {/* Phone Mockup - WhatsApp Bot */}
              <motion.div 
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                className="relative z-20 -mr-12 mb-12 sm:mb-0 sm:mr-0"
              >
                <div className="bg-slate-900 border-4 border-slate-800 rounded-[2.5rem] p-2 shadow-2xl w-[280px] mx-auto overflow-hidden">
                  <div className="bg-slate-950 rounded-[2rem] h-[500px] overflow-hidden relative">
                    {/* Fake WhatsApp UI */}
                    <div className="bg-[#075E54] p-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-white text-sm font-bold">PopSystem Bot</div>
                        <div className="text-green-100 text-xs">Online</div>
                      </div>
                    </div>
                    <div className="p-4 space-y-4 bg-[#e5ddd5] h-full bg-opacity-10">
                      <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm max-w-[85%] text-xs text-slate-800">
                        Olá! 👋 Bem-vindo ao Burger King da Esquina. Posso anotar seu pedido?
                      </div>
                      <div className="bg-[#dcf8c6] p-3 rounded-lg rounded-tr-none shadow-sm max-w-[85%] ml-auto text-xs text-slate-800">
                        Quero um X-Bacon e uma Coca.
                      </div>
                      <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm max-w-[85%] text-xs text-slate-800">
                        <p>Perfeito! 🍔🥤</p>
                        <p className="mt-1"><strong>1x X-Bacon</strong> (R$ 28,00)</p>
                        <p><strong>1x Coca-Cola Lata</strong> (R$ 6,00)</p>
                        <p className="mt-2 text-slate-500 text-[10px]">Endereço de entrega é o mesmo?</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Desktop Dashboard Mockup (Floating Behind/Next) */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="absolute top-1/2 left-1/2 sm:left-auto sm:right-0 transform -translate-x-1/2 sm:translate-x-10 -translate-y-1/2 z-10 w-[320px] sm:w-[400px]"
              >
                <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
                  <div className="bg-slate-900 p-3 border-b border-slate-700 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                      <div className="text-slate-400 text-xs mb-1">Vendas Hoje</div>
                      <div className="text-green-400 text-xl font-bold">R$ 1.250</div>
                    </div>
                    <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                      <div className="text-slate-400 text-xs mb-1">Pedidos</div>
                      <div className="text-white text-xl font-bold">14</div>
                    </div>
                    <div className="col-span-2 bg-slate-700/30 p-3 rounded-lg border border-slate-600 h-24 flex items-end gap-1">
                      {[40, 60, 45, 70, 50, 80, 65].map((h, i) => (
                        <div key={i} className="flex-1 bg-boracume-orange/80 rounded-t-sm" style={{ height: `${h}%` }}></div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Bottom Fade to White */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
    </section>
  );
};

export default HeroSection;
