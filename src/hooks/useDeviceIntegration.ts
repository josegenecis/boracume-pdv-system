
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PrinterService, PrinterDevice } from '@/services/PrinterService';
import { ScaleService, ScaleDevice } from '@/services/ScaleService';

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

  // Initialize services
  const printerService = new PrinterService();
  const scaleService = new ScaleService();

  const scanForDevices = useCallback(async () => {
    setIsScanning(true);
    
    try {
      const [printers, scales] = await Promise.all([
        printerService.scanForPrinters(),
        scaleService.scanForScales()
      ]);

      const deviceList: Device[] = [
        ...printers.map((printer: PrinterDevice) => ({
          id: printer.id,
          name: printer.name,
          type: 'printer' as const,
          connectionType: printer.type as any,
          status: printer.connected ? 'connected' as const : 'disconnected' as const,
          address: printer.address
        })),
        ...scales.map((scale: ScaleDevice) => ({
          id: scale.id,
          name: scale.name,
          type: 'scale' as const,
          connectionType: scale.type as any,
          status: scale.connected ? 'connected' as const : 'disconnected' as const,
          address: scale.address
        }))
      ];

      setDevices(deviceList);
      
      toast({
        title: "Escaneamento concluído",
        description: `${deviceList.length} dispositivos encontrados.`,
      });
    } catch (error) {
      console.error('Erro no escaneamento:', error);
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
      let success = false;

      if (device.type === 'printer') {
        const printers = await printerService.scanForPrinters();
        const printer = printers.find(p => p.id === deviceId);
        if (printer) {
          success = await printerService.connectToPrinter(printer);
        }
      } else if (device.type === 'scale') {
        const scales = await scaleService.scanForScales();
        const scale = scales.find(s => s.id === deviceId);
        if (scale) {
          success = await scaleService.connectToScale(scale);
        }
      }

      if (success) {
        setDevices(prev => prev.map(d => 
          d.id === deviceId ? { ...d, status: 'connected' } : d
        ));

        toast({
          title: "Dispositivo conectado",
          description: `${device.name} conectado com sucesso.`,
        });
      } else {
        throw new Error('Falha na conexão');
      }
    } catch (error) {
      console.error('Erro na conexão:', error);
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
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    try {
      if (device.type === 'printer') {
        await printerService.disconnectPrinter();
      } else if (device.type === 'scale') {
        await scaleService.disconnectScale();
      }

      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, status: 'disconnected' } : d
      ));
      
      toast({
        title: "Dispositivo desconectado",
        description: "Dispositivo desconectado com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível desconectar o dispositivo.",
        variant: "destructive"
      });
    }
  }, [devices, toast]);

  const getWeight = useCallback(async (): Promise<number> => {
    const connectedScale = devices.find(d => d.type === 'scale' && d.status === 'connected');
    
    if (!connectedScale) {
      throw new Error('Nenhuma balança conectada');
    }

    try {
      return await scaleService.getWeight();
    } catch (error) {
      console.error('Erro ao obter peso:', error);
      throw new Error('Erro ao ler peso da balança');
    }
  }, [devices]);

  const printReceipt = useCallback(async (orderData: any): Promise<void> => {
    const connectedPrinter = devices.find(d => d.type === 'printer' && d.status === 'connected');
    
    if (!connectedPrinter) {
      throw new Error('Nenhuma impressora conectada');
    }

    try {
      const success = await printerService.printReceipt(orderData);
      
      if (success) {
        toast({
          title: "Comprovante impresso",
          description: `Pedido #${orderData.order_number} impresso com sucesso.`,
        });
      } else {
        throw new Error('Falha na impressão');
      }
    } catch (error) {
      console.error('Erro na impressão:', error);
      toast({
        title: "Erro na impressão",
        description: "Não foi possível imprimir o comprovante.",
        variant: "destructive"
      });
      throw error;
    }
  }, [devices, toast]);

  // Auto-scan on mount
  useEffect(() => {
    scanForDevices();
  }, []);

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
