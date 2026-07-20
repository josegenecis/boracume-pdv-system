
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useInputValidation } from '@/hooks/useInputValidation';
import { loginSchema, signupSchema, type LoginData, type SignupData } from '@/schemas/authSchemas';
import { logSecurityEvent, logSignupEvent } from '@/utils/securityLogger';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { debugLogger } from '@/utils/debugLogger';

import { handleOAuthError } from '../../utils/oauth-errors';
import { logOAuthLoginAttempt, logOAuthLoginFailure } from '../../utils/oauth-security-logger';

type AuthFormProps = {
  defaultTab?: 'login' | 'register';
};

const AuthForm: React.FC<AuthFormProps> = ({ defaultTab = 'login' }) => {
  const { signIn, signUp, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Estados para controle de submissão
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false);
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false);

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  
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

      const desktopApi = window.electronAPI;
      const isDesktop = Boolean(desktopApi?.isElectron && desktopApi.openExternal);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: isDesktop ? 'https://popsystem.com.br/auth/callback?desktop=1' : `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: isDesktop,
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

      if (isDesktop && data?.url) {
        const openResult = await desktopApi.openExternal(data.url);
        if (!openResult?.success) throw new Error(openResult?.error || 'Não foi possível abrir o navegador.');
        toast({
          title: 'Continue no navegador',
          description: 'Após entrar com o Google, você voltará automaticamente ao PopSystem.',
        });
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
      const { data, error } = await supabase.functions.invoke('auth-recovery-email', {
        body: {
          email: loginData.email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));
      
      toast({
        title: "Email enviado",
        description: "Enviamos um link seguro da PopSystem para redefinir sua senha.",
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

  const GoogleIcon = () => (
    <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <Logo />
        </div>
        <CardDescription className="text-center">
          Sistema completo para seu restaurante
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab} className="w-full">
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
                <div className="relative">
                  <Input
                    id="password"
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Sua senha"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    disabled={isSubmittingLogin || isLoading}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
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
                    <GoogleIcon />
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
                <div className="relative">
                  <Input
                    id="registerPassword"
                    type={showSignupPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    disabled={isSubmittingSignup || isLoading}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowSignupPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                {signupValidation.errors.password && (
                  <p className="text-sm text-red-500">{signupValidation.errors.password}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showSignupConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirme sua senha"
                    value={signupData.confirmPassword}
                    onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                    disabled={isSubmittingSignup || isLoading}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowSignupConfirmPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showSignupConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
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
