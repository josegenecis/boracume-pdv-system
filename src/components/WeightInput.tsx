import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Scale, RefreshCw } from 'lucide-react';

interface WeightInputProps {
  onWeightChange?: (weight: number) => void;
  className?: string;
}

export const WeightInput: React.FC<WeightInputProps> = ({ 
  onWeightChange, 
  className = '' 
}) => {
  const [weight, setWeight] = useState<number>(0);
  const [isReading, setIsReading] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [connectedScales, setConnectedScales] = useState<any[]>([]);

  useEffect(() => {
    // Verificar se está rodando no Electron
    setIsElectron(typeof window !== 'undefined' && window.electronAPI !== undefined);
  }, []);

  useEffect(() => {
    if (isElectron && window.electronAPI) {
      loadConnectedScales();
    }
  }, [isElectron]);

  const loadConnectedScales = async () => {
    try {
      if (window.electronAPI?.getConnectedDevices) {
        const devices = await window.electronAPI.getConnectedDevices();
        setConnectedScales(devices.scales || []);
      }
    } catch (error) {
      console.error('Erro ao carregar balanças conectadas:', error);
    }
  };

  const readWeight = async () => {
    if (!isElectron || !window.electronAPI?.readWeight) {
      return;
    }

    setIsReading(true);
    try {
      const result = await window.electronAPI.readWeight();
      if (result.success && typeof result.weight === 'number') {
        setWeight(result.weight);
        onWeightChange?.(result.weight);
      }
    } catch (error) {
      console.error('Erro ao ler peso:', error);
    } finally {
      setIsReading(false);
    }
  };

  const handleManualWeightChange = (value: string) => {
    const numericValue = parseFloat(value) || 0;
    setWeight(numericValue);
    onWeightChange?.(numericValue);
  };

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="h-5 w-5" />
          Entrada de Peso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status das balanças conectadas */}
        {isElectron && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Balanças Conectadas:</span>
              <Badge variant={connectedScales.length > 0 ? 'default' : 'secondary'}>
                {connectedScales.length}
              </Badge>
            </div>
            {connectedScales.map((scale, index) => (
              <div key={index} className="text-xs text-muted-foreground">
                {scale.name} - {scale.port}
              </div>
            ))}
          </div>
        )}

        {/* Display do peso atual */}
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">
            {weight.toFixed(3)} kg
          </div>
        </div>

        {/* Controles */}
        <div className="space-y-3">
          {/* Leitura automática (apenas no Electron) */}
          {isElectron && connectedScales.length > 0 && (
            <Button 
              onClick={readWeight} 
              disabled={isReading}
              className="w-full"
              variant="default"
            >
              {isReading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Lendo...
                </>
              ) : (
                <>
                  <Scale className="mr-2 h-4 w-4" />
                  Ler Peso
                </>
              )}
            </Button>
          )}

          {/* Input manual */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Peso Manual (kg):</label>
            <Input
              type="number"
              step="0.001"
              min="0"
              value={weight}
              onChange={(e) => handleManualWeightChange(e.target.value)}
              placeholder="0.000"
              className="text-center"
            />
          </div>
        </div>

        {/* Informações adicionais */}
        <div className="text-xs text-muted-foreground text-center">
          {isElectron ? (
            connectedScales.length > 0 ? (
              'Balança conectada - leitura automática disponível'
            ) : (
              'Nenhuma balança conectada - apenas entrada manual'
            )
          ) : (
            'Modo web - apenas entrada manual disponível'
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeightInput;