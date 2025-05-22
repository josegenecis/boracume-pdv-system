
import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LocationInputProps {
  onLocationSelect: (location: { address: string; lat?: number; lng?: number }) => void;
  initialAddress?: string;
}

const LocationInput: React.FC<LocationInputProps> = ({ onLocationSelect, initialAddress = '' }) => {
  const [address, setAddress] = useState(initialAddress);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();
  
  // This would be connected to a real geocoding API in production
  const getAddressSuggestions = (query: string) => {
    // Simulate API call with fake data
    setLoading(true);
    
    // Mock suggestions based on input
    setTimeout(() => {
      if (!query) {
        setSuggestions([]);
        setLoading(false);
        return;
      }
      
      // Create mock suggestions
      const mockSuggestions = [
        `${query}, Rua Principal, São Paulo`,
        `${query}, Avenida Central, Rio de Janeiro`,
        `${query}, Centro, Belo Horizonte`,
        `${query}, Setor Sul, Goiânia`,
      ];
      
      setSuggestions(mockSuggestions);
      setLoading(false);
    }, 500);
  };
  
  useEffect(() => {
    // Add debounce for API calls
    const handler = setTimeout(() => {
      if (address.length > 2) {
        getAddressSuggestions(address);
      } else {
        setSuggestions([]);
      }
    }, 300);
    
    return () => clearTimeout(handler);
  }, [address]);
  
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
    setShowSuggestions(true);
  };
  
  const handleSuggestionSelect = (suggestion: string) => {
    setAddress(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    
    // In a real app, we'd get coordinates from the API
    // For now, we'll use mock coordinates
    onLocationSelect({
      address: suggestion,
      lat: -23.5505,  // Mock latitude
      lng: -46.6333   // Mock longitude
    });
    
    toast({
      title: "Endereço selecionado",
      description: suggestion
    });
  };
  
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In a real app, we'd use reverse geocoding to get an address
          // For now, we'll use mock data
          const mockAddress = "Sua localização atual, São Paulo";
          setAddress(mockAddress);
          
          onLocationSelect({
            address: mockAddress,
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          
          setLoading(false);
          
          toast({
            title: "Localização obtida",
            description: "Usamos sua localização atual"
          });
        },
        (error) => {
          setLoading(false);
          
          toast({
            title: "Erro ao obter localização",
            description: "Não foi possível acessar sua localização atual.",
            variant: "destructive"
          });
          
          console.error("Error getting location:", error);
        }
      );
    } else {
      toast({
        title: "Localização não suportada",
        description: "Seu navegador não suporta geolocalização.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="relative">
      <div className="flex space-x-2">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input
            value={address}
            onChange={handleAddressChange}
            placeholder="Digite seu endereço completo"
            className="pl-10"
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          {loading && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleGetCurrentLocation}
          disabled={loading}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Usar Localização Atual
        </Button>
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute mt-1 w-full z-10">
          <CardContent className="p-0">
            <ul className="py-1">
              {suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onClick={() => handleSuggestionSelect(suggestion)}
                >
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground" />
                    <span>{suggestion}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LocationInput;
