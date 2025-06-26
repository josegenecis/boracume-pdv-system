
import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  type: 'no-user' | 'loading' | 'no-profile';
}

export const DigitalMenuErrorStates: React.FC<ErrorStateProps> = ({ type }) => {
  if (type === 'no-user') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8 max-w-2xl">
          <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-red-700 mb-2">Erro: Link Inválido</h1>
          <p className="text-red-600 mb-4">ID do usuário não encontrado na URL.</p>
        </div>
      </div>
    );
  }

  if (type === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center max-w-4xl mx-auto p-8">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mb-4 mx-auto"></div>
          <p className="text-lg font-semibold mb-4">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (type === 'no-profile') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-yellow-50">
        <div className="text-center p-8 max-w-4xl mx-auto">
          <AlertCircle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold text-yellow-700 mb-2">Restaurante não encontrado</h1>
          <p className="text-yellow-600 mb-4">Este restaurante pode não existir ou estar indisponível.</p>
        </div>
      </div>
    );
  }

  return null;
};
