import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Volume2 } from 'lucide-react';
import { soundNotifications } from '@/utils/soundUtils';

const SoundPermissionHelper: React.FC = () => {
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    // Verificar se o áudio está suspenso ou bloqueado
    const checkAudioContext = () => {
      // @ts-ignore
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
          setNeedsPermission(true);
        }
        ctx.close(); // Clean up temp context
      }
    };

    checkAudioContext();
    
    // Fallback: Verificar localStorage também
    const soundAlreadyUnlocked = localStorage.getItem('sound_unlocked') === 'true';
    if (!soundAlreadyUnlocked && soundNotifications.isAudioSupported()) {
      setNeedsPermission(true);
    }
  }, []);

  const enableAudio = async () => {
    try {
      await soundNotifications.enableSound();
      localStorage.setItem('sound_unlocked', 'true');
      setNeedsPermission(false);
    } catch (error) {
      console.error('❌ Erro ao habilitar áudio:', error);
    }
  };

  if (!needsPermission) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[260px] max-w-[calc(100vw-2rem)]">
      <Card className="border border-blue-200 bg-blue-50/95 shadow-md backdrop-blur">
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">
              Ativar som
            </span>
          </div>
          
          <p className="mb-3 text-xs leading-5 text-blue-700">
            Habilite o som para novos pedidos. A ativação não reproduz áudio de teste.
          </p>
          
          <Button 
            onClick={enableAudio}
            className="h-8 w-full bg-blue-600 text-xs font-semibold hover:bg-blue-700"
            size="sm"
          >
            Ativar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SoundPermissionHelper;
