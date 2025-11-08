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
    { href: '#precos', label: 'Preços' },
    { href: '#depoimentos', label: 'Depoimentos' },
    { href: '#contato', label: 'Contato' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-boracume-orange/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-boracume-orange rounded-lg flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <Logo size="md" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-boracume-gray hover:text-boracume-orange transition-colors duration-200 font-medium"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/login">
              <Button variant="ghost" className="text-boracume-gray hover:text-boracume-orange">
                Entrar
              </Button>
            </Link>
            <Button className="bg-boracume-orange hover:bg-boracume-orange/90 text-white">
              Teste Grátis
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden p-2 rounded-lg hover:bg-boracume-orange/10 transition-colors"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-boracume-gray" />
            ) : (
              <Menu className="w-6 h-6 text-boracume-gray" />
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
              className="md:hidden border-t border-boracume-orange/20 bg-white"
            >
              <div className="py-4 space-y-4">
                {menuItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="block px-4 py-2 text-boracume-gray hover:text-boracume-orange hover:bg-boracume-orange/5 rounded-lg transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                <div className="px-4 pt-4 border-t border-boracume-orange/20 space-y-2">
                  <Link to="/login" className="block">
                    <Button variant="ghost" className="w-full justify-start text-boracume-gray hover:text-boracume-orange">
                      Entrar
                    </Button>
                  </Link>
                  <Button className="w-full bg-boracume-orange hover:bg-boracume-orange/90 text-white">
                    Teste Grátis
                  </Button>
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