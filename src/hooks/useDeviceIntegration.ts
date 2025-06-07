
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface Device {
  id: string;
  name: string;
  type: 'scale' | 'printer';
  connectionType: 'bluetooth' | 'wifi' | 'usb';
  status: 'connected' | 'disconnected' | 'connecting';
  address?: string;
}

export const useDeviceIntegration = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  // Simular dispositivos disponíveis
  const mockDevices: Device[] = [
    { id: 'scale_001', name: 'Balança Toledo 3400', type: 'scale', connectionType: 'bluetooth', status: 'disconnected' },
    { id: 'scale_002', name: 'Balança Filizola BP-15', type: 'scale', connectionType: 'usb', status: 'disconnected' },
    { id: 'printer_001', name: 'Impressora Bematech MP-4200', type: 'printer', connectionType: 'usb', status: 'disconnected' },
    { id: 'printer_002', name: 'Impressora Epson TM-T20', type: 'printer', connectionType: 'wifi', status: 'disconnected' },
  ];

  useEffect(() => {
    setDevices(mockDevices);
  }, []);

  const scanForDevices = useCallback(async () => {
    setIsScanning(true);
    
    try {
      // Simular escaneamento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Atualizar lista de dispositivos
      setDevices(prev => prev.map(device => ({
        ...device,
        status: Math.random() > 0.5 ? 'disconnected' : 'connected' as any
      })));
      
      toast({
        title: "Escaneamento concluído",
        description: "Dispositivos encontrados e atualizados.",
      });
    } catch (error) {
      toast({
        title: "Erro no escaneamento",
        description: "Não foi possível escanear dispositivos.",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  }, [toast]);

  const connectDevice = useCallback(async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    setDevices(prev => prev.map(d => 
      d.id === deviceId ? { ...d, status: 'connecting' } : d
    ));

    try {
      // Simular conexão
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, status: 'connected' } : d
      ));

      toast({
        title: "Dispositivo conectado",
        description: `${device.name} conectado com sucesso.`,
      });
    } catch (error) {
      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, status: 'disconnected' } : d
      ));
      
      toast({
        title: "Erro na conexão",
        description: `Não foi possível conectar ${device.name}.`,
        variant: "destructive"
      });
    }
  }, [devices, toast]);

  const disconnectDevice = useCallback(async (deviceId: string) => {
    setDevices(prev => prev.map(d => 
      d.id === deviceId ? { ...d, status: 'disconnected' } : d
    ));
    
    toast({
      title: "Dispositivo desconectado",
      description: "Dispositivo desconectado com sucesso.",
    });
  }, [toast]);

  const getWeight = useCallback(async (): Promise<number> => {
    const connectedScale = devices.find(d => d.type === 'scale' && d.status === 'connected');
    
    if (!connectedScale) {
      throw new Error('Nenhuma balança conectada');
    }

    // Simular leitura de peso
    await new Promise(resolve => setTimeout(resolve, 1000));
    return parseFloat((Math.random() * 5).toFixed(3));
  }, [devices]);

  const printReceipt = useCallback(async (orderData: any): Promise<void> => {
    const connectedPrinter = devices.find(d => d.type === 'printer' && d.status === 'connected');
    
    if (!connectedPrinter) {
      throw new Error('Nenhuma impressora conectada');
    }

    // Simular impressão
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Comprovante impresso",
      description: `Pedido #${orderData.order_number} impresso com sucesso.`,
    });
  }, [devices, toast]);

  return {
    devices,
    isScanning,
    scanForDevices,
    connectDevice,
    disconnectDevice,
    getWeight,
    printReceipt
  };
};
