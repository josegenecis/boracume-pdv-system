import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '@/components/Logo';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const menuItems = [
    { href: '#funcionalidades', label: 'Funcionalidades' },
    { href: '#como-funciona', label: 'Como Funciona' },
    { href: '#precos', label: 'Preços' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-boracume-orange/10 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-boracume-orange to-red-500 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-200">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">
              BoraCumê
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-gray-600 hover:text-boracume-orange transition-colors duration-200 font-medium text-sm tracking-wide"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/login">
              <Button variant="ghost" className="text-gray-600 hover:text-boracume-orange font-medium">
                Entrar
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-boracume-orange hover:bg-boracume-orange/90 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-300 transform hover:-translate-y-0.5 font-bold px-6">
                Testar 30 Dias Grátis
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-gray-100 bg-white shadow-xl rounded-b-2xl overflow-hidden"
            >
              <div className="py-4 space-y-2 px-4">
                {menuItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="block px-4 py-3 text-gray-600 hover:text-boracume-orange hover:bg-orange-50 rounded-xl transition-all font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                <div className="pt-4 space-y-3 border-t border-gray-100 mt-2">
                  <Link to="/login" className="block">
                    <Button variant="ghost" className="w-full justify-center text-gray-600 hover:text-boracume-orange">
                      Entrar
                    </Button>
                  </Link>
                  <Link to="/signup" className="block">
                    <Button className="w-full bg-boracume-orange hover:bg-boracume-orange/90 text-white font-bold shadow-lg shadow-orange-500/20">
                      Testar 30 Dias Grátis
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;
