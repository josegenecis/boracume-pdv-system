
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Loader2 } from 'lucide-react';

interface CustomerLocationInputProps {
  onLocationSelect: (address: string, lat?: number, lng?: number) => void;
  defaultAddress?: string;
}

const CustomerLocationInput: React.FC<CustomerLocationInputProps> = ({
  onLocationSelect,
  defaultAddress = ''
}) => {
  const [address, setAddress] = useState(defaultAddress);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingCurrentLocation, setIsGettingCurrentLocation] = useState(false);
  const { toast } = useToast();

  const handleSearchAddress = async () => {
    if (!address.trim()) {
      toast({
        title: "Endereço não informado",
        description: "Por favor, insira um endereço para buscar",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // In a real app, we would use a geocoding API here
      // For now, we'll just simulate a search delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate finding an address
      onLocationSelect(address);
      toast({
        title: "Endereço encontrado",
        description: "Endereço localizado com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro ao buscar endereço",
        description: "Não foi possível localizar o endereço informado",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGetCurrentLocation = () => {
    setIsGettingCurrentLocation(true);
    
    if (!navigator.geolocation) {
      toast({
        title: "Geolocalização não suportada",
        description: "Seu navegador não suporta geolocalização",
        variant: "destructive"
      });
      setIsGettingCurrentLocation(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // In a real app, we would use reverse geocoding to get the address
          // For now, we'll just simulate it
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const simulatedAddress = "Av. Paulista, 1000 - Bela Vista, São Paulo - SP";
          setAddress(simulatedAddress);
          onLocationSelect(simulatedAddress, latitude, longitude);
          
          toast({
            title: "Localização encontrada",
            description: "Sua localização atual foi encontrada com sucesso!",
          });
        } catch (error) {
          toast({
            title: "Erro ao obter localização",
            description: "Não foi possível determinar sua localização atual",
            variant: "destructive"
          });
        } finally {
          setIsGettingCurrentLocation(false);
        }
      },
      (error) => {
        let errorMessage = "Erro desconhecido ao obter localização";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Permissão para acessar localização foi negada";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Informações de localização não disponíveis";
            break;
          case error.TIMEOUT:
            errorMessage = "Tempo esgotado ao obter localização";
            break;
        }
        
        toast({
          title: "Erro de geolocalização",
          description: errorMessage,
          variant: "destructive"
        });
        
        setIsGettingCurrentLocation(false);
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          <Input
            placeholder="Digite seu endereço completo"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <Button onClick={handleSearchAddress} disabled={isLoading || isGettingCurrentLocation}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
        </Button>
        <Button
          variant="outline"
          onClick={handleGetCurrentLocation}
          disabled={isLoading || isGettingCurrentLocation}
        >
          {isGettingCurrentLocation ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <Card className="mt-4 bg-gray-50">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">Dicas para busca de endereço:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Informe o logradouro, número e bairro</li>
              <li>Adicione a cidade e estado para resultados mais precisos</li>
              <li>Ou use o botão de localização para usar sua localização atual</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerLocationInput;
