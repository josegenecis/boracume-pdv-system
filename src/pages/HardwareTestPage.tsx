import React, { useMemo } from 'react';

const HardwareTestPage: React.FC = () => {
  const capabilities = useMemo(() => {
    const navAny = navigator as any;
    return [
      { name: 'Bluetooth (Web Bluetooth)', available: typeof navAny?.bluetooth !== 'undefined' },
      { name: 'USB (WebUSB)', available: typeof navAny?.usb !== 'undefined' },
      { name: 'Serial (Web Serial)', available: typeof navAny?.serial !== 'undefined' },
      { name: 'NFC (Web NFC)', available: typeof navAny?.nfc !== 'undefined' },
      { name: 'Wake Lock', available: typeof navAny?.wakeLock !== 'undefined' },
      { name: 'MediaDevices', available: typeof navAny?.mediaDevices !== 'undefined' },
    ];
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-2">Teste de Hardware</h1>
        <p className="text-gray-600 mb-6">
          Esta página valida rapidamente quais APIs do navegador estão disponíveis no dispositivo.
        </p>

        <div className="space-y-3">
          {capabilities.map((c) => (
            <div key={c.name} className="flex items-center justify-between border rounded-md px-4 py-3">
              <span className="font-medium">{c.name}</span>
              <span className={c.available ? 'text-green-600 font-semibold' : 'text-gray-500'}>
                {c.available ? 'Disponível' : 'Indisponível'}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Recarregar
          </button>
          <button
            onClick={() => window.history.back()}
            className="bg-gray-200 text-gray-900 px-4 py-2 rounded hover:bg-gray-300"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
};

export default HardwareTestPage;
