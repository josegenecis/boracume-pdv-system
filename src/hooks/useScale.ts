
import { useState, useEffect, useCallback } from 'react';
import { useDeviceIntegration } from './useDeviceIntegration';
import { useToast } from '@/hooks/use-toast';

export const useScale = () => {
  const [currentWeight, setCurrentWeight] = useState<number>(0);
  const [isReading, setIsReading] = useState(false);
  const [autoRead, setAutoRead] = useState(false);
  const { devices, getWeight } = useDeviceIntegration();
  const { toast } = useToast();

  const connectedScale = devices.find(d => d.type === 'scale' && d.status === 'connected');

  const readWeight = useCallback(async () => {
    if (!connectedScale) {
      toast({
        title: "Balança não conectada",
        description: "Conecte uma balança antes de ler o peso.",
        variant: "destructive"
      });
      return;
    }

    setIsReading(true);
    try {
      const weight = await getWeight();
      setCurrentWeight(weight);
      return weight;
    } catch (error) {
      console.error('Erro ao ler peso:', error);
      toast({
        title: "Erro na leitura",
        description: "Não foi possível ler o peso da balança.",
        variant: "destructive"
      });
    } finally {
      setIsReading(false);
    }
  }, [connectedScale, getWeight, toast]);

  const tareScale = useCallback(() => {
    setCurrentWeight(0);
    toast({
      title: "Tara realizada",
      description: "Peso zerado com sucesso.",
    });
  }, [toast]);

  // Auto-read weight every 2 seconds when enabled
  useEffect(() => {
    if (!autoRead || !connectedScale) return;

    const interval = setInterval(() => {
      readWeight();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRead, connectedScale, readWeight]);

  return {
    currentWeight,
    isReading,
    autoRead,
    setAutoRead,
    readWeight,
    tareScale,
    isConnected: !!connectedScale
  };
};
