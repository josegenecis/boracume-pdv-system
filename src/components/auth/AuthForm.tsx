
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useInputValidation } from '@/hooks/useInputValidation';
import { loginSchema, signupSchema, type LoginData, type SignupData } from '@/schemas/authSchemas';
import { logSecurityEvent, logSignupEvent } from '@/utils/securityLogger';
import { Loader2 } from 'lucide-react';
import { debugLogger } from '@/utils/debugLogger';

import { handleOAuthError } from '../../utils/oauth-errors';
import { logOAuthLoginAttempt, logOAuthLoginFailure } from '../../utils/oauth-security-logger';

const AuthForm: React.FC = () => {
  const { signIn, signUp, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Estados para controle de submissão
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false);
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false);
  
  // Refs para debounce
  const loginTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const signupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const googleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Login form state
  const [loginData, setLoginData] = useState<LoginData>({
    email: '',
    password: ''
  });
  
  // Register form state
  const [signupData, setSignupData] = useState<SignupData>({
    email: '',
    password: '',
    confirmPassword: '',
    restaurantName: '',
    name: ''
  });
  
  // Validation hooks
  const loginValidation = useInputValidation(loginSchema);
  const signupValidation = useInputValidation(signupSchema);
  
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir múltiplas submissões
    if (isSubmittingLogin || isLoading) {
      debugLogger.form('login_submission_blocked', { 
        isSubmittingLogin, 
        isLoading 
      }, 'warn');
      return;
    }
    
    if (!loginValidation.validate(loginData)) {
      return;
    }
    
    debugLogger.form('login_submission_started', { email: loginData.email });
    setIsSubmittingLogin(true);
    
    // Debounce para evitar cliques duplos
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
    }
    
    try {
      await signIn(loginData.email, loginData.password);
      await logSecurityEvent('login', `Successful login for ${loginData.email}`, 'low');
      debugLogger.form('login_submission_success', { email: loginData.email });
    } catch (error: any) {
      debugLogger.form('login_submission_error', { 
        email: loginData.email,
        error: error.message 
      }, 'error');
      await logSecurityEvent('failed_login', `Failed login attempt for ${loginData.email}: ${error.message}`, 'medium');
    } finally {
      // Reset com delay REDUZIDO para 500ms para evitar cliques rápidos
      loginTimeoutRef.current = setTimeout(() => {
        setIsSubmittingLogin(false);
      }, 500);
    }
  };
  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir múltiplas submissões
    if (isSubmittingSignup || isLoading) {
      console.log('🚫 [AUTH FORM] Signup já em andamento - ignorando');
      return;
    }
    
    if (!signupValidation.validate(signupData)) {
      return;
    }
    
    console.log('📝 [AUTH FORM] Iniciando cadastro...');
    setIsSubmittingSignup(true);
    
    // Debounce para evitar cliques duplos
    if (signupTimeoutRef.current) {
      clearTimeout(signupTimeoutRef.current);
    }
    
    try {
      await signUp(signupData.email, signupData.password, signupData.restaurantName);
      await logSignupEvent(signupData.email);
      console.log('✅ [AUTH FORM] Cadastro realizado com sucesso');
    } catch (error: any) {
      console.error('❌ [AUTH FORM] Erro no cadastro:', error);
    } finally {
      // Reset com delay REDUZIDO para 500ms para evitar cliques rápidos
      signupTimeoutRef.current = setTimeout(() => {
        setIsSubmittingSignup(false);
      }, 500);
    }
  };
  
  const handleGoogleLogin = async () => {
    // Prevenir múltiplas submissões
    if (isSubmittingGoogle || isLoading) {
      console.log('🚫 [AUTH FORM] Login Google já em andamento - ignorando');
      return;
    }
    
    console.log('🔐 [AUTH FORM] Iniciando login com Google...');
    setIsSubmittingGoogle(true);
    
    // Debounce para evitar cliques duplos
    if (googleTimeoutRef.current) {
      clearTimeout(googleTimeoutRef.current);
    }
    
    try {
      // Log da tentativa de login
      await logOAuthLoginAttempt('google', {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referrer: document.referrer
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        console.error('❌ [AUTH FORM] Erro no login com Google:', error);
        
        // Log da falha no login
        await logOAuthLoginFailure('google', error.message, {
          errorCode: error.status,
          errorDetails: error
        });
        
        handleOAuthError(error);
        return;
      }

      console.log('✅ [AUTH FORM] Redirecionamento para Google OAuth iniciado');
      
    } catch (error: any) {
      console.error('❌ [AUTH FORM] Erro inesperado no login com Google:', error);
      
      // Log da falha inesperada
      await logOAuthLoginFailure('google', 'Erro inesperado durante login', {
        error: error.message,
        stack: error.stack
      });
      
      handleOAuthError(error);
    } finally {
      // Reset com delay REDUZIDO para 1 segundo para OAuth
      googleTimeoutRef.current = setTimeout(() => {
        setIsSubmittingGoogle(false);
      }, 1000);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginData.email) {
      toast({
        title: "Email necessário",
        description: "Por favor digite seu email para recuperar sua senha.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(loginData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast({
        title: "Email enviado",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
    } catch (error: any) {
      console.error('Erro ao enviar email de recuperação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o email de recuperação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Cleanup dos timeouts
  React.useEffect(() => {
    return () => {
      if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current);
      if (signupTimeoutRef.current) clearTimeout(signupTimeoutRef.current);
      if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
    };
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <Logo />
        </div>
        <CardTitle className="text-2xl text-center">BoraCumê</CardTitle>
        <CardDescription className="text-center">
          Sistema completo para seu restaurante
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="register">Cadastrar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="space-y-4">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  disabled={isSubmittingLogin || isLoading}
                  required
                />
                {loginValidation.errors.email && (
                  <p className="text-sm text-red-500">{loginValidation.errors.email}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Sua senha"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  disabled={isSubmittingLogin || isLoading}
                  required
                />
                {loginValidation.errors.password && (
                  <p className="text-sm text-red-500">{loginValidation.errors.password}</p>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmittingLogin || isLoading}
              >
                {isSubmittingLogin ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="w-full relative"
                onClick={handleGoogleLogin}
                disabled={isSubmittingGoogle || isLoading}
              >
                {isSubmittingGoogle ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                      <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                    </svg>
                    Entrar com Google
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                variant="link"
                className="w-full text-sm"
                onClick={handleForgotPassword}
                disabled={isSubmittingLogin || isLoading}
              >
                Esqueci minha senha
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="register" className="space-y-4">
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={signupData.name}
                  onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                  disabled={isSubmittingSignup || isLoading}
                  required
                />
                {signupValidation.errors.name && (
                  <p className="text-sm text-red-500">{signupValidation.errors.name}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="restaurantName">Nome do restaurante</Label>
                <Input
                  id="restaurantName"
                  type="text"
                  placeholder="Nome do seu restaurante"
                  value={signupData.restaurantName}
                  onChange={(e) => setSignupData({ ...signupData, restaurantName: e.target.value })}
                  disabled={isSubmittingSignup || isLoading}
                  required
                />
                {signupValidation.errors.restaurantName && (
                  <p className="text-sm text-red-500">{signupValidation.errors.restaurantName}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="registerEmail">Email</Label>
                <Input
                  id="registerEmail"
                  type="email"
                  placeholder="seu@email.com"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  disabled={isSubmittingSignup || isLoading}
                  required
                />
                {signupValidation.errors.email && (
                  <p className="text-sm text-red-500">{signupValidation.errors.email}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="registerPassword">Senha</Label>
                <Input
                  id="registerPassword"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  disabled={isSubmittingSignup || isLoading}
                  required
                />
                {signupValidation.errors.password && (
                  <p className="text-sm text-red-500">{signupValidation.errors.password}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirme sua senha"
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                  disabled={isSubmittingSignup || isLoading}
                  required
                />
                {signupValidation.errors.confirmPassword && (
                  <p className="text-sm text-red-500">{signupValidation.errors.confirmPassword}</p>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmittingSignup || isLoading}
              >
                {isSubmittingSignup ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  'Criar conta'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AuthForm;
