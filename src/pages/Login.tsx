
import React from 'react';
import AuthForm from '@/components/auth/AuthForm';

const Login = () => {
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
