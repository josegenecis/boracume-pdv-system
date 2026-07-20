import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { trackMarketing } from '@/lib/marketingAnalytics';

const menuItems = [
  { href: '#produto', label: 'Produto' },
  { href: '#funcionalidades', label: 'Plataforma' },
  { href: '#inteligencia', label: 'Inteligência' },
  { href: '#planos', label: 'Planos' },
  { href: '#duvidas', label: 'Dúvidas' },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#dfe8e1]/80 bg-white/95 backdrop-blur-xl">
      <div className="container flex h-[72px] items-center justify-between">
        <Link to="/" aria-label="Página inicial PopSystem"><Logo size="md" /></Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
          {menuItems.map(item => <a key={item.href} href={item.href} className="text-sm font-bold text-[#4f675e] transition hover:text-[#ef6c20]">{item.label}</a>)}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" className="font-bold text-[#315548] hover:bg-[#edf5ee] hover:text-[#064733]"><a href="/login" onClick={() => trackMarketing('landing_login_click', 'header')}>Entrar</a></Button>
          <Button asChild className="rounded-xl bg-[#ef6c20] px-5 font-black text-white shadow-lg shadow-orange-200/60 hover:bg-[#dc5c14]"><a href="/login?tab=register" onClick={() => trackMarketing('landing_signup_click', 'header')}>Começar agora <ArrowRight className="ml-2 h-4 w-4" /></a></Button>
        </div>

        <button type="button" onClick={() => setIsMenuOpen(value => !value)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1f5f1] text-[#064733] md:hidden" aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={isMenuOpen}>
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {isMenuOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-[#e7ece8] bg-white md:hidden">
          <nav className="container space-y-1 py-4" aria-label="Navegação móvel">
            {menuItems.map(item => <a key={item.href} href={item.href} onClick={() => setIsMenuOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-bold text-[#315548] hover:bg-[#f1f6f1]">{item.label}</a>)}
            <div className="grid grid-cols-2 gap-2 pt-3"><Button asChild variant="outline" className="w-full rounded-xl font-bold"><a href="/login" onClick={() => trackMarketing('landing_login_click', 'mobile_menu')}>Entrar</a></Button><Button asChild className="w-full rounded-xl bg-[#ef6c20] font-black text-white"><a href="/login?tab=register" onClick={() => trackMarketing('landing_signup_click', 'mobile_menu')}>Começar</a></Button></div>
          </nav>
        </motion.div>}
      </AnimatePresence>
    </header>
  );
};

export default Header;
