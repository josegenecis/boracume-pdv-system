
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Scale, RotateCcw, Play, Pause } from 'lucide-react';
import { useScale } from '@/hooks/useScale';

interface WeightInputProps {
  onWeightConfirm: (weight: number) => void;
  unit?: string;
}

const WeightInput: React.FC<WeightInputProps> = ({ 
  onWeightConfirm, 
  unit = 'kg' 
}) => {
  const {
    currentWeight,
    isReading,
    autoRead,
    setAutoRead,
    readWeight,
    tareScale,
    isConnected
  } = useScale();

  const handleConfirmWeight = () => {
    onWeightConfirm(currentWeight);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale size={20} />
            Balança
          </div>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Conectada" : "Desconectada"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Display peso atual */}
        <div className="text-center">
          <div className="text-4xl font-bold text-primary mb-2">
            {currentWeight.toFixed(3)} {unit}
          </div>
          {isReading && (
            <div className="text-sm text-muted-foreground">
              Lendo peso...
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={readWeight}
            disabled={!isConnected || isReading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Scale size={16} />
            Ler Peso
          </Button>
          
          <Button
            onClick={tareScale}
            disabled={!isConnected}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Tarar
          </Button>
        </div>

        {/* Auto-read toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-read" className="text-sm">
            Leitura automática
          </Label>
          <Switch
            id="auto-read"
            checked={autoRead}
            onCheckedChange={setAutoRead}
            disabled={!isConnected}
          />
        </div>

        {/* Confirm button */}
        <Button
          onClick={handleConfirmWeight}
          disabled={!isConnected || currentWeight <= 0}
          className="w-full"
          size="lg"
        >
          Confirmar Peso ({currentWeight.toFixed(3)} {unit})
        </Button>

        {!isConnected && (
          <div className="text-center text-sm text-muted-foreground">
            Conecte uma balança nas configurações de dispositivos
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeightInput;
