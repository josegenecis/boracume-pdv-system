import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Volume2 } from 'lucide-react';

const SoundPermissionHelper: React.FC = () => {
  const [needsPermission, setNeedsPermission] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  useEffect(() => {
    // Verificar se o áudio precisa de permissão
    const checkAudioPermission = () => {
      try {
        const audio = new Audio();
        const playPromise = audio.play();
        
        if (playPromise) {
          playPromise.catch((error) => {
            if (error.name === 'NotAllowedError') {
              setNeedsPermission(true);
            }
          });
        }
      } catch (error) {
        console.log('Verificação de permissão de áudio falhou');
      }
    };

    checkAudioPermission();
  }, []);

  const enableAudio = async () => {
    try {
      // Criar contexto de áudio para contornar política de autoplay
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      setAudioContext(ctx);
      setNeedsPermission(false);
      
      // Testar reprodução de som
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
      
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