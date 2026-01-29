import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ScaleIntegrationSettings: React.FC = () => {
  const support = useMemo(() => {
    const navAny = navigator as any;
    return {
      bluetooth: typeof navAny?.bluetooth !== 'undefined',
      serial: typeof navAny?.serial !== 'undefined',
      usb: typeof navAny?.usb !== 'undefined',
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integração com Balança</CardTitle>
        <CardDescription>
          Configure a leitura de peso via Bluetooth/USB/Serial quando disponível no dispositivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border rounded-md p-3">
            <div className="font-medium">Bluetooth</div>
            <div className={support.bluetooth ? 'text-green-600' : 'text-gray-500'}>
              {support.bluetooth ? 'Disponível' : 'Indisponível'}
            </div>
          </div>
          <div className="border rounded-md p-3">
            <div className="font-medium">USB</div>
            <div className={support.usb ? 'text-green-600' : 'text-gray-500'}>
              {support.usb ? 'Disponível' : 'Indisponível'}
            </div>
          </div>
          <div className="border rounded-md p-3">
            <div className="font-medium">Serial</div>
            <div className={support.serial ? 'text-green-600' : 'text-gray-500'}>
              {support.serial ? 'Disponível' : 'Indisponível'}
            </div>
          </div>
        </div>
        <div className="text-gray-600">
          Em breve: pareamento, seleção de dispositivo e leitura contínua do peso no PDV.
        </div>
      </CardContent>
    </Card>
  );
};

export default ScaleIntegrationSettings;
