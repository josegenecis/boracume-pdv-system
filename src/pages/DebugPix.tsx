import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function DebugPix() {
  const { user } = useAuth();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testPix = async () => {
    if (!user) return alert('Faça login primeiro');
    setLoading(true);
    setResult('Iniciando teste...');
    try {
      // Payload simulado de um pedido
      const orderPayload = {
        total: 1.00, // R$ 1,00
        customer_name: 'Teste Debug',
        order_number: 'DEBUG-' + Date.now(),
        payment_method: 'pix'
      };

      const { data, error } = await supabase.functions.invoke('pix-start-checkout', {
        body: { 
          restaurantUserId: user.id, 
          orderPayload, 
          preferredMethod: 'pix' 
        }
      });

      if (error) {
        console.error('Erro na função:', error);
        setResult({ error: error.message || error, details: error });
      } else {
        console.log('Sucesso:', data);
        setResult(data);
      }
    } catch (e: any) {
      console.error('Exceção:', e);
      setResult({ exception: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Debug Pix Integration</h1>
      <p>Teste direto da Edge Function sem passar pelo carrinho.</p>
      
      <Button onClick={testPix} disabled={loading}>
        {loading ? 'Testando...' : 'Gerar PIX de Teste (R$ 1,00)'}
      </Button>

      <div className="mt-4">
        <h3 className="font-bold">Resultado:</h3>
        <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs max-h-[500px]">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>

      {result?.brCode && (
        <div className="mt-4">
          <h3 className="font-bold">QR Code Gerado:</h3>
          <textarea readOnly className="w-full h-24 p-2 border" value={result.brCode} />
          {result.qrCodeImage && <img src={result.qrCodeImage} alt="QR Code" className="w-48 h-48 mt-2" />}
        </div>
      )}
    </div>
  );
}
