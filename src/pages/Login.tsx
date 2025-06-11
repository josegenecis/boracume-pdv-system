
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/auth/AuthForm';

const Login = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Login page - user:', user?.email, 'isLoading:', isLoading);
    
    // Se o usuário já está logado, redirecionar para dashboard
    if (user && !isLoading) {
      console.log('User is logged in, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [user, isLoading, navigate]);

  // Se está carregando, mostrar loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-boracume-light">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-boracume-orange"></div>
      </div>
    );
  }

  // Se já está logado, não mostrar o formulário (vai redirecionar)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-boracume-light">
      <div className="w-full max-w-md">
        <AuthForm />
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        BoraCumê - Sistema completo de delivery e PDV para restaurantes
      </p>
    </div>
  );
};

export default Login;
