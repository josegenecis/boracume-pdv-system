
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login');
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-boracume-light">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">BoraCumê</h1>
        <p className="text-xl text-gray-600">Redirecionando...</p>
      </div>
    </div>
  );
};

export default Index;
