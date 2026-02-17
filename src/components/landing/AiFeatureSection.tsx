import React from 'react';
import { motion } from 'framer-motion';
import { Scan, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AiFeatureSection = () => {
  return (
    <section className="py-24 bg-slate-900 relative overflow-hidden" id="funcionalidades">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-boracume-orange/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column: Visual Animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative mx-auto max-w-md">
              {/* Cardápio de Papel (Origem) */}
              <div className="absolute top-0 left-0 w-48 h-64 bg-white rotate-[-6deg] shadow-xl p-4 rounded-lg border border-slate-200 z-10 transform transition-transform group-hover:rotate-[-12deg]">
                <div className="w-full h-full border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center space-y-2 opacity-50">
                  <div className="w-16 h-2 bg-slate-200 rounded"></div>
                  <div className="w-24 h-2 bg-slate-200 rounded"></div>
                  <div className="w-20 h-2 bg-slate-200 rounded"></div>
                </div>
                <div className="absolute -top-3 -left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow">
                  Antes
                </div>
              </div>

              {/* Scanning Laser Effect */}
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute left-[-20%] w-[140%] h-1 bg-gradient-to-r from-transparent via-boracume-orange to-transparent z-30 blur-sm"
              ></motion.div>

              {/* Celular (Destino) */}
              <div className="relative ml-24 mt-12 w-56 bg-slate-800 rounded-[2rem] border-4 border-slate-700 shadow-2xl p-2 z-20">
                <div className="bg-slate-900 rounded-[1.5rem] overflow-hidden h-96 relative">
                  {/* Digital Menu UI */}
                  <div className="h-32 bg-boracume-orange/20 relative">
                    <div className="absolute bottom-4 left-4 text-white font-bold text-lg">Burger King</div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex gap-3 items-center bg-slate-800 p-2 rounded-xl border border-slate-700">
                      <div className="w-12 h-12 bg-orange-500/20 rounded-lg"></div>
                      <div>
                        <div className="w-20 h-2 bg-slate-600 rounded mb-1"></div>
                        <div className="w-12 h-2 bg-boracume-orange rounded"></div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center bg-slate-800 p-2 rounded-xl border border-slate-700">
                      <div className="w-12 h-12 bg-orange-500/20 rounded-lg"></div>
                      <div>
                        <div className="w-20 h-2 bg-slate-600 rounded mb-1"></div>
                        <div className="w-12 h-2 bg-boracume-orange rounded"></div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center bg-slate-800 p-2 rounded-xl border border-slate-700">
                      <div className="w-12 h-12 bg-orange-500/20 rounded-lg"></div>
                      <div>
                        <div className="w-20 h-2 bg-slate-600 rounded mb-1"></div>
                        <div className="w-12 h-2 bg-boracume-orange rounded"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Success Badge */}
                  <motion.div 
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    transition={{ delay: 1, type: "spring" }}
                    className="absolute bottom-4 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Pronto!
                  </motion.div>
                </div>
              </div>

            </div>
          </motion.div>

          {/* Right Column: Copy */}
          <div className="order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-boracume-orange/10 border border-boracume-orange/20 text-boracume-orange font-semibold text-sm mb-6">
                <Scan className="w-4 h-4" />
                <span>Produtividade Máxima</span>
              </div>
              
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
                "Ah, mas dá preguiça cadastrar os produtos..." <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-boracume-orange to-yellow-500">
                  Nós resolvemos isso para você.
                </span>
              </h2>

              <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                Não perca dias digitando. Tire uma foto do seu cardápio, mande no nosso WhatsApp e a nossa <strong className="text-white">IA do GPT-4</strong> cadastra todos os pratos, descrições e preços para você em 60 segundos.
              </p>

              <Button className="bg-white text-slate-900 hover:bg-gray-100 font-bold px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all">
                Quero testar a IA agora
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default AiFeatureSection;
