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
      console.log('🔄 useOrderNotifications - Carregando configurações...');
      
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        console.log('📋 useOrderNotifications - Configurações carregadas:', data);
        
        setEnabled(data.sound_enabled);
        setVolume(parseFloat(data.volume) / 100);
        setSoundType(data.order_sound);

        // Configurar URLs personalizadas no sistema de som
        const customUrls = {
          custom_bell_url: data.custom_bell_url,
          custom_chime_url: data.custom_chime_url,
          custom_ding_url: data.custom_ding_url,
          custom_notification_url: data.custom_notification_url,
        };
        
        console.log('🎵 useOrderNotifications - Configurando sons personalizados:', customUrls);
        soundNotifications.setCustomSoundUrls(customUrls);
        
        // Configurar volume e status
        soundNotifications.setEnabled(data.sound_enabled);
        soundNotifications.setVolume(parseFloat(data.volume) / 100);
      }
    };

    loadSettings();

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
          console.log('🔊 useOrderNotifications - Estado atual:', { enabled, soundType, volume });
          
          if (enabled) {
            // Reproduzir som de notificação
            try {
              console.log(`🎵 useOrderNotifications - Reproduzindo som: ${soundType}`);
              await soundNotifications.playSound(soundType);
              console.log('✅ useOrderNotifications - Som reproduzido com sucesso');
            } catch (error) {
              console.error('❌ useOrderNotifications - Erro ao reproduzir som:', error);
            }
          } else {
            console.log('🔇 useOrderNotifications - Som desabilitado');
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
    console.log('🔄 useOrderNotifications - Atualizando configurações:', { enabled, volume, soundType });
    soundNotifications.setEnabled(enabled);
    soundNotifications.setVolume(volume);
  }, [enabled, volume, soundType]);

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