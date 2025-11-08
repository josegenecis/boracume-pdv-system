import React from 'react';

const TestPage: React.FC = () => {
  console.log('TestPage renderizou com sucesso!');
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-green-600 mb-4">
          ✅ Página de Teste Funcionando!
        </h1>
        <p className="text-gray-600 mb-4">
          Se você está vendo esta página, o roteamento básico está funcionando.
        </p>
        <div className="space-y-2">
          <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
          <p><strong>URL:</strong> {window.location.href}</p>
          <p><strong>User Agent:</strong> {navigator.userAgent.substring(0, 50)}...</p>
        </div>
        <div className="mt-6">
          <button 
            onClick={() => window.history.back()}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestPage;