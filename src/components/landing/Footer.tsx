import React from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, Mail, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 text-white border-t border-slate-900">
      
      {/* CTA Final */}
      <div className="border-b border-slate-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-8 max-w-4xl mx-auto leading-tight">
            Pronto para modernizar seu restaurante?
          </h2>
          <Link to="/signup">
            <Button className="bg-white text-slate-950 hover:bg-gray-100 font-bold px-10 py-8 text-xl rounded-2xl shadow-[0_0_50px_-15px_rgba(255,255,255,0.3)] transition-all transform hover:scale-105">
              Agendar demonstração
              <ArrowRight className="ml-2 w-6 h-6" />
            </Button>
          </Link>
          <p className="mt-6 text-slate-500">
            Conheça uma plataforma completa para gestão, operação, atendimento e marketing.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo e Descrição */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-boracume-orange rounded-lg flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">PopSystem</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              O Sistema Operacional do Restaurante Moderno: PDV, delivery, cardápio digital, WhatsApp, marketing, financeiro, estoque e equipe em uma única plataforma.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Plataforma</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#funcionalidades" className="text-slate-400 hover:text-boracume-orange transition-colors">Funcionalidades</a></li>
              <li><a href="#ia" className="text-slate-400 hover:text-boracume-orange transition-colors">Inteligência Artificial</a></li>
              <li><a href="#marketing" className="text-slate-400 hover:text-boracume-orange transition-colors">Marketing</a></li>
              <li><a href="#precos" className="text-slate-400 hover:text-boracume-orange transition-colors">Planos</a></li>
              <li><Link to="/login" className="text-slate-400 hover:text-boracume-orange transition-colors">Login</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/termos" className="text-slate-400 hover:text-boracume-orange transition-colors">Termos de Uso</Link></li>
              <li><Link to="/privacidade" className="text-slate-400 hover:text-boracume-orange transition-colors">Política de Privacidade</Link></li>
              <li><Link to="/lgpd" className="text-slate-400 hover:text-boracume-orange transition-colors">LGPD</Link></li>
            </ul>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Fale Conosco</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2 text-slate-400">
                <Mail className="w-4 h-4 text-boracume-orange" />
                <span>contato@popsystem.com.br</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400">
                <MapPin className="w-4 h-4 text-boracume-orange" />
                <span>São Paulo, SP</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-900 mt-12 pt-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center">
          <p className="text-slate-500 text-sm">
            © {currentYear} PopSystem Tecnologia Ltda.
          </p>
          <div className="flex space-x-4 mt-4 md:mt-0">
             {/* Social icons if needed */}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
