
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PrinterService, PrinterDevice } from '@/services/PrinterService';
import { ScaleService, ScaleDevice } from '@/services/ScaleService';
import { ElectronDeviceService, ElectronDevice } from '@/services/ElectronDeviceService';

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
  const electronService = new ElectronDeviceService();
  const isElectron = electronService.isElectronEnvironment();

  const scanForDevices = useCallback(async () => {
    setIsScanning(true);
    
    try {
      let deviceList: Device[] = [];

      if (isElectron) {
        // Use Electron's native device scanning
        const electronDevices = await electronService.scanForDevices();
        
        deviceList = electronDevices.map((device: ElectronDevice) => ({
          id: device.id,
          name: device.name,
          type: device.name.toLowerCase().includes('balance') || device.name.toLowerCase().includes('scale') ? 'scale' as const : 'printer' as const,
          connectionType: device.type as any,
          status: device.connected ? 'connected' as const : 'disconnected' as const,
          address: device.id
        }));
      } else {
        // Fallback to web simulation
        const [printers, scales] = await Promise.all([
          printerService.scanForPrinters(),
          scaleService.scanForScales()
        ]);

        deviceList = [
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
      }

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
  }, [toast, isElectron]);

  const connectDevice = useCallback(async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    setDevices(prev => prev.map(d => 
      d.id === deviceId ? { ...d, status: 'connecting' } : d
    ));

    try {
      let success = false;

      if (isElectron) {
        // Use Electron's native device connection
        const electronDevice: ElectronDevice = {
          id: device.id,
          name: device.name,
          type: device.connectionType as any,
          connected: false
        };

        if (device.type === 'printer') {
          success = await electronService.connectPrinter(electronDevice);
        } else if (device.type === 'scale') {
          success = await electronService.connectScale(electronDevice);
        }
      } else {
        // Fallback to web simulation
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
  }, [devices, toast, isElectron]);

  const disconnectDevice = useCallback(async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    try {
      if (isElectron) {
        if (device.type === 'printer') {
          await electronService.disconnectPrinter();
        } else if (device.type === 'scale') {
          await electronService.disconnectScale();
        }
      } else {
        if (device.type === 'printer') {
          await printerService.disconnectPrinter();
        } else if (device.type === 'scale') {
          await scaleService.disconnectScale();
        }
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
  }, [devices, toast, isElectron]);

  const getWeight = useCallback(async (): Promise<number> => {
    const connectedScale = devices.find(d => d.type === 'scale' && d.status === 'connected');
    
    if (!connectedScale) {
      throw new Error('Nenhuma balança conectada');
    }

    try {
      if (isElectron) {
        return await electronService.readWeight();
      } else {
        return await scaleService.getWeight();
      }
    } catch (error) {
      console.error('Erro ao obter peso:', error);
      throw new Error('Erro ao ler peso da balança');
    }
  }, [devices, isElectron]);

  const printReceipt = useCallback(async (orderData: any): Promise<void> => {
    const connectedPrinter = devices.find(d => d.type === 'printer' && d.status === 'connected');
    
    if (!connectedPrinter) {
      throw new Error('Nenhuma impressora conectada');
    }

    try {
      let success = false;

      if (isElectron) {
        success = await electronService.printReceipt(orderData);
      } else {
        success = await printerService.printReceipt(orderData);
      }
      
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
  }, [devices, toast, isElectron]);

  // Auto-scan on mount
  useEffect(() => {
    scanForDevices();
  }, []);

  return {
    devices,
    isScanning,
    isElectron,
    scanForDevices,
    connectDevice,
    disconnectDevice,
    getWeight,
    printReceipt
  };
};
