import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LandingPage from './LandingPage';
import MenuDigital from './MenuDigital';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams();
  
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);

  // Lógica de roteamento baseada em domínio/subdomínio
  useEffect(() => {
    const resolveDomain = async () => {
      try {
        const search = new URLSearchParams(location.search || '');
        const code = search.get('code') || '';
        const typeFromQuery = search.get('type') || '';
        const hash = window.location.hash || '';
        const isRecovery =
          typeFromQuery.toLowerCase() === 'recovery' ||
          /type=recovery/i.test(hash) ||
          /recovery/i.test(hash) ||
          Boolean(code);

        if (location.pathname === '/' && isRecovery) {
          navigate(`/reset-password${location.search || ''}${hash || ''}`, { replace: true });
          return;
        }
      } catch {}

      const hostname = window.location.hostname;
      
      // 1. Domínios que DEVEM mostrar a Landing Page (sistema principal)
      const mainDomains = ['popsystem.com.br', 'www.popsystem.com.br', 'boracume.com', 'www.boracume.com', 'localhost', 'boracume-pdv-system.vercel.app'];
      const isMainDomain = mainDomains.includes(hostname) || hostname.endsWith('.vercel.app'); // Simplificação para dev

      // Se estamos na rota raiz '/' E é um domínio principal -> Landing Page
      if (isMainDomain && location.pathname === '/' && !userId) {
        setIsResolving(false);
        return; 
      }

      // 2. Se for subdomínio (ex: pizzaria.boracume.com) -> Tentar achar o restaurante
      // (Lógica simplificada: se não for main domain, assume que é tenant)
      if (!isMainDomain) {
         // Aqui você buscaria no Supabase qual restaurante tem esse custom_domain ou subdomain
         // Ex: const { data } = await supabase.from('profiles').select('id').eq('subdomain', subdomain).single();
         // Por enquanto, vamos assumir que não temos subdomínios configurados e cair no default
      }

      setIsResolving(false);
    };

    resolveDomain();
  }, [location.pathname, location.search, navigate, userId]);

  // Se a rota tem userId explícito (ex: /cardapio/:userId), renderiza o Menu
  if (userId) {
    return <MenuDigital />;
  }

  // Se o usuário está logado e acessou a raiz, vai pro Dashboard
  if (!loading && session) {
    // Redirecionamento movido para dentro do useEffect para evitar warning
    // mas aqui no render retornamos null enquanto o navigate acontece
    // O AuthContext ou App.tsx geralmente já lidam com proteção de rotas, 
    // mas se o usuário logado acessar a raiz, mandamos pro dashboard.
    // navigate('/dashboard'); 
    // return null;
    // (Melhor deixar o AppRoutes gerenciar isso ou retornar Landing se quiser que logado veja landing)
  }

  if (isResolving) {
     return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div></div>;
  }

  // Se não é rota de cardápio e não resolveu nenhum restaurante -> Landing Page
  return <LandingPage />;
};

export default Index;
