
import React, { useState } from 'react';
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

import { handleOAuthError } from '../../utils/oauth-errors';
import { logOAuthLoginAttempt, logOAuthLoginFailure } from '../../utils/oauth-security-logger';


const AuthForm: React.FC = () => {
  const { signIn, signUp, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
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
    
    if (!loginValidation.validate(loginData)) {
      return;
    }
    
    try {
      await signIn(loginData.email, loginData.password);
      await logSecurityEvent('login', `Successful login for ${loginData.email}`, 'low');
      console.log('Login successful, will redirect');
    } catch (error: any) {
      console.error('Login error:', error);
      await logSecurityEvent('failed_login', `Failed login attempt for ${loginData.email}: ${error.message}`, 'medium');
    }
  };
  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupValidation.validate(signupData)) {
      return;
    }
    
    try {
      await signUp(signupData.email, signupData.password, signupData.restaurantName);
      // Log usando a função específica que evita o erro de tipo
      await logSignupEvent(signupData.email);
      console.log('Signup successful, will redirect');
    } catch (error: any) {
      console.error('Signup error:', error);
    }
  };
  
  const handleGoogleLogin = async () => {
    try {

      console.log('🔐 Iniciando login com Google...');
      
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
        console.error('❌ Erro no login com Google:', error);
        
        // Log da falha no login
        await logOAuthLoginFailure('google', error.message, {
          errorCode: error.status,
          errorDetails: error
        });
        
        handleOAuthError(error);
        return;
      }

      console.log('✅ Redirecionamento para Google OAuth iniciado');
      
    } catch (error: any) {
      console.error('❌ Erro inesperado no login com Google:', error);
      
      // Log da falha inesperada
      await logOAuthLoginFailure('google', 'Erro inesperado durante login', {
        error: error.message,
        stack: error.stack
      });
      
      handleOAuthError(error);

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
      
      await logSecurityEvent('password_change', `Password reset requested for ${loginData.email}`, 'medium');
    } catch (error: any) {
      toast({
        title: "Erro ao recuperar senha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1 flex flex-col items-center">
        <Logo size="lg" />
        <CardTitle className="text-2xl mt-4">Bem-vindo ao BoraCumê</CardTitle>
        <CardDescription>
          Gerencie seu restaurante de forma simples e eficiente
        </CardDescription>
      </CardHeader>
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Registrar</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLoginSubmit}>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  value={loginData.email}
                  onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                  required 
                />
                {loginValidation.errors.email && (
                  <p className="text-sm text-red-500">{loginValidation.errors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm text-boracume-orange hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  required 
                />
                {loginValidation.errors.password && (
                  <p className="text-sm text-red-500">{loginValidation.errors.password}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col">
              <Button className="w-full bg-boracume-orange hover:bg-boracume-orange/90" type="submit" disabled={isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
              <div className="relative my-4 w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Ou continue com</span>
                </div>
              </div>
              <Button variant="outline" type="button" className="w-full" onClick={handleGoogleLogin} disabled={isLoading}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
                Entrar com Google
              </Button>
            </CardFooter>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form onSubmit={handleRegisterSubmit}>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="restaurant-name">Nome do Restaurante</Label>
                <Input 
                  id="restaurant-name" 
                  type="text" 
                  placeholder="Restaurante do João" 
                  value={signupData.restaurantName}
                  onChange={(e) => setSignupData(prev => ({ ...prev, restaurantName: e.target.value }))}
                  required 
                />
                {signupValidation.errors.restaurantName && (
                  <p className="text-sm text-red-500">{signupValidation.errors.restaurantName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Seu Nome</Label>
                <Input 
                  id="name" 
                  type="text" 
                  placeholder="João da Silva"
                  value={signupData.name}
                  onChange={(e) => setSignupData(prev => ({ ...prev, name: e.target.value }))} 
                  required 
                />
                {signupValidation.errors.name && (
                  <p className="text-sm text-red-500">{signupValidation.errors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input 
                  id="register-email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  value={signupData.email}
                  onChange={(e) => setSignupData(prev => ({ ...prev, email: e.target.value }))}
                  required 
                />
                {signupValidation.errors.email && (
                  <p className="text-sm text-red-500">{signupValidation.errors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Senha</Label>
                <Input 
                  id="register-password" 
                  type="password" 
                  value={signupData.password}
                  onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                  required 
                />
                {signupValidation.errors.password && (
                  <p className="text-sm text-red-500">{signupValidation.errors.password}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input 
                  id="confirm-password" 
                  type="password" 
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required 
                />
                {signupValidation.errors.confirmPassword && (
                  <p className="text-sm text-red-500">{signupValidation.errors.confirmPassword}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col">
              <Button className="w-full bg-boracume-green hover:bg-boracume-green/90" type="submit" disabled={isLoading}>
                {isLoading ? 'Registrando...' : 'Criar Conta'}
              </Button>
              <div className="relative my-4 w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Ou continue com</span>
                </div>
              </div>
              <Button variant="outline" type="button" className="w-full" onClick={handleGoogleLogin} disabled={isLoading}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
                Registrar com Google
              </Button>
            </CardFooter>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default AuthForm;
