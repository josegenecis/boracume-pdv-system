import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { soundNotifications } from '@/utils/soundUtils';

export const useOrderNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [soundType, setSoundType] = useState('bell');

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

    // Configurar sistema de som
    soundNotifications.setEnabled(enabled);
    soundNotifications.setVolume(volume);

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
        async (payload) => {
          console.log('🔔 Novo pedido recebido:', payload);
          
          if (enabled) {
            // Reproduzir som de notificação via Web Audio API
            try {
              await soundNotifications.playSound(soundType);
            } catch (error) {
              console.error('Erro ao reproduzir som:', error);
            }
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

  // Atualizar configurações quando mudarem
  useEffect(() => {
    soundNotifications.setEnabled(enabled);
    soundNotifications.setVolume(volume);
  }, [enabled, volume]);

  const playTestSound = async () => {
    try {
      await soundNotifications.playSound(soundType);
    } catch (error) {
      console.error('Erro no teste de som:', error);
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