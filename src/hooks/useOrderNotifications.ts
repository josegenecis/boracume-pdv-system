
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useOrderNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [soundType, setSoundType] = useState('bell');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!user) return;

    // Carregar configurações de notificação do usuário
    const loadSettings = async () => {
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setEnabled(data.sound_enabled);
        setVolume(parseFloat(data.volume) / 100);
        setSoundType(data.order_sound);
      }
    };

    loadSettings();

    // Configurar áudio
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

    // Escutar novos pedidos em tempo real
    const channel = supabase
      .channel('new-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Novo pedido recebido:', payload);
          
          if (enabled && audioRef.current) {
            // Reproduzir som de notificação
            const soundUrl = `/sounds/${soundType}.mp3`;
            audioRef.current.src = soundUrl;
            audioRef.current.play().catch(console.error);
          }

          // Mostrar toast
          toast({
            title: "Novo Pedido!",
            description: `Pedido #${payload.new.order_number} recebido`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, enabled, volume, soundType, toast]);

  const playTestSound = () => {
    if (audioRef.current) {
      const soundUrl = `/sounds/${soundType}.mp3`;
      audioRef.current.src = soundUrl;
      audioRef.current.volume = volume;
      audioRef.current.play().catch(console.error);
    }
  };

  return {
    enabled,
    setEnabled,
    volume,
    setVolume,
    soundType,
    setSoundType,
    playTestSound
  };
};
