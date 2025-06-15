import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Volume2 } from 'lucide-react';
import { soundNotifications } from '@/utils/soundUtils';

const SoundPermissionHelper: React.FC = () => {
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    // Verificar se Web Audio API está disponível
    if (!soundNotifications.isAudioSupported()) {
      setNeedsPermission(true);
    } else {
      // Verificar se precisa de interação do usuário
      const checkPermission = async () => {
        try {
          await soundNotifications.playSound('bell');
          setNeedsPermission(false);
        } catch (error) {
          console.log('Necessita interação do usuário para áudio');
          setNeedsPermission(true);
        }
      };
      
      checkPermission();
    }
  }, []);

  const enableAudio = async () => {
    try {
      await soundNotifications.enableSound();
      await soundNotifications.playSound('bell');
      setNeedsPermission(false);
      console.log('Áudio habilitado com sucesso');
    } catch (error) {
      console.error('Erro ao habilitar áudio:', error);
    }
  };

  if (!needsPermission) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="border-2 border-blue-300 bg-blue-50 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Volume2 className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-800">
              Habilitar Som de Notificação
            </span>
          </div>
          
          <p className="text-sm text-blue-700 mb-3">
            Clique para permitir notificações sonoras quando novos pedidos chegarem.
          </p>
          
          <Button 
            onClick={enableAudio}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            Habilitar Som
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SoundPermissionHelper;