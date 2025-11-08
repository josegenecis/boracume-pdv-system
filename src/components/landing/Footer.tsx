import React from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, Mail, Phone, MapPin, Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo e Descrição */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">BoraCumê</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              A plataforma completa de gestão para restaurantes e delivery. 
              Otimize suas operações, aumente vendas e melhore a experiência do cliente.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Produto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Produto</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#funcionalidades" className="text-gray-400 hover:text-white transition-colors">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="#precos" className="text-gray-400 hover:text-white transition-colors">
                  Preços
                </a>
              </li>
              <li>
                <Link to="/demo" className="text-gray-400 hover:text-white transition-colors">
                  Demonstração
                </Link>
              </li>
              <li>
                <Link to="/teste-gratuito" className="text-gray-400 hover:text-white transition-colors">
                  Teste Grátis
                </Link>
              </li>
            </ul>
          </div>

          {/* Empresa */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Empresa</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#depoimentos" className="text-gray-400 hover:text-white transition-colors">
                  Cases de Sucesso
                </a>
              </li>
              <li>
                <Link to="/contato" className="text-gray-400 hover:text-white transition-colors">
                  Contato
                </Link>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Carreiras
                </a>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contato</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2 text-gray-400">
                <Mail className="w-4 h-4" />
                <span>contato@boracume.com</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <Phone className="w-4 h-4" />
                <span>(11) 9999-9999</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>São Paulo, SP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Linha divisória */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-400 text-sm">
              © {currentYear} BoraCumê. Todos os direitos reservados.
            </p>
            <div className="flex space-x-6 text-sm">
              <Link to="/politica-privacidade" className="text-gray-400 hover:text-white transition-colors">
                Política de Privacidade
              </Link>
              <Link to="/termos-uso" className="text-gray-400 hover:text-white transition-colors">
                Termos de Uso
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;