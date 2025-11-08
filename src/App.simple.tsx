import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TestPage from '@/pages/TestPage';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';

// Versão simplificada do App para testar sem contextos
function SimpleApp() {
  console.log('SimpleApp carregou!');
  
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div className="p-8"><h1>Home Simples</h1><a href="/test" className="text-blue-500">Ir para Teste</a></div>} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default SimpleApp;