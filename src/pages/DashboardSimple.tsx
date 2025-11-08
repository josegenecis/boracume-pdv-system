import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';

const DashboardSimple = () => {
  const { user, profile, subscription, loading } = useAuth();

  console.log('🔍 [DASHBOARD-SIMPLE] Renderizando componente');
  console.log('🔍 [DASHBOARD-SIMPLE] User:', user?.id);
  console.log('🔍 [DASHBOARD-SIMPLE] Profile:', profile?.id);
  console.log('🔍 [DASHBOARD-SIMPLE] Subscription:', subscription?.id);
  console.log('🔍 [DASHBOARD-SIMPLE] Loading:', loading);

  if (loading) {
    console.log('🔍 [DASHBOARD-SIMPLE] Mostrando loading...');
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg">Carregando dashboard simplificado...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    console.log('🔍 [DASHBOARD-SIMPLE] Usuário não encontrado');
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-lg text-red-500">Usuário não encontrado</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  console.log('🔍 [DASHBOARD-SIMPLE] Renderizando dashboard completo');
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard Simplificado</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">Informações do Usuário</h2>
            <p><strong>ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email}</p>
          </div>
          
          {profile && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-2">Perfil</h2>
              <p><strong>Nome:</strong> {profile.full_name || 'Não informado'}</p>
              <p><strong>Telefone:</strong> {profile.phone || 'Não informado'}</p>
            </div>
          )}
          
          {subscription && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-2">Assinatura</h2>
              <p><strong>Status:</strong> {subscription.status}</p>
              <p><strong>Plano:</strong> {subscription.plan_id}</p>
            </div>
          )}
        </div>
        
        <div className="mt-8 bg-green-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold text-green-800 mb-2">✅ Dashboard Carregado com Sucesso!</h2>
          <p className="text-green-700">
            Este é um dashboard simplificado para testar se o problema de loading infinito foi resolvido.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardSimple;