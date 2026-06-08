import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { logSecurityEvent } from '@/utils/securityLogger';
import { handleOAuthError, extractOAuthErrorFromUrl } from '@/utils/oauth-errors';
import { logOAuthCallbackReceived, logOAuthCallbackError, logOAuthLoginSuccess } from '../utils/oauth-security-logger';
import { getLocalOperatorSession, getOperatorPathForRequestedPath } from '@/services/operatorAuth';

const AuthCallback = () => {
  const { syncGoogleUserData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Processando callback OAuth...');
        
        // Log do callback recebido
        await logOAuthCallbackReceived('google', true, {
          url: window.location.href,
          hasCode: new URLSearchParams(window.location.search).has('code'),
          hasState: new URLSearchParams(window.location.search).has('state')
        });
        
        // Verificar se há erro na URL primeiro
        const urlError = extractOAuthErrorFromUrl();
        if (urlError) {
          console.warn('⚠️ Erro OAuth detectado na URL:', urlError);
          
          // Log do erro no callback
          await logOAuthCallbackError('google', urlError.message, {
            errorCode: urlError.code,
            errorDescription: urlError.description
          });
          
          await handleOAuthError(urlError, 'callback_url');
          navigate('/login');
          return;
        }
        
        // Obter sessão do hash da URL
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro no callback OAuth:', error);
          
          // Log do erro de sessão
          await logOAuthCallbackError('google', error.message, {
            errorType: 'session_error',
            errorDetails: error
          });
          
          await handleOAuthError(error, 'callback_session');
          navigate('/login');
          return;
        }

        if (session?.user) {
          console.log('✅ Usuário autenticado via OAuth:', session.user.email);
          
          try {
            // Sincronizar dados do usuário Google
            await syncGoogleUserData(session.user);
            
            // Log do sucesso do login
            await logOAuthLoginSuccess('google', session.user.id, session.user.email || '', {
              provider: 'google',
              syncSuccess: true
            });
            
            // Log de segurança tradicional
            await logSecurityEvent('oauth_success', `User ${session.user.email} authenticated via OAuth`, 'low');
            
            toast.success('Login realizado com sucesso!');
            navigate(getOperatorPathForRequestedPath(getLocalOperatorSession(), '/dashboard'));
          } catch (syncError: any) {
            console.error('❌ Erro na sincronização:', syncError);
            
            // Log do erro de sincronização
            await logOAuthCallbackError('google', syncError.message, {
              errorType: 'sync_error',
              userId: session.user.id,
              email: session.user.email
            });
            
            await handleOAuthError(syncError, 'user_sync');
            
            // Mesmo com erro de sincronização, permitir login
            toast.warning('Login realizado, mas alguns dados podem não estar atualizados.');
            navigate(getOperatorPathForRequestedPath(getLocalOperatorSession(), '/dashboard'));
          }
        } else {
          console.warn('⚠️ Nenhuma sessão encontrada no callback');
          
          // Log da ausência de sessão
          await logOAuthCallbackError('google', 'Nenhuma sessão encontrada após callback', {
            errorType: 'no_session'
          });
          
          await handleOAuthError('no_session', 'callback_no_session');
          navigate('/login');
        }
      } catch (error: any) {
        console.error('💥 Erro inesperado no callback:', error);
        
        // Log do erro inesperado
        await logOAuthCallbackError('google', error.message, {
          errorType: 'unexpected_error',
          stack: error.stack
        });
        
        await handleOAuthError(error, 'callback_unexpected');
        navigate('/login');
      }
    };

    handleAuthCallback();
  }, [syncGoogleUserData, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Finalizando login...</h2>
        <p className="text-gray-500">Aguarde enquanto processamos sua autenticação.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
