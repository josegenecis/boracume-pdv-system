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


        // Configurar URLs personalizadas no sistema de som (apenas URLs válidas)
        const customUrls = {
          custom_bell_url: data.custom_bell_url && data.custom_bell_url.trim() !== '' ? data.custom_bell_url : null,
          custom_chime_url: data.custom_chime_url && data.custom_chime_url.trim() !== '' ? data.custom_chime_url : null,
          custom_ding_url: data.custom_ding_url && data.custom_ding_url.trim() !== '' ? data.custom_ding_url : null,
          custom_notification_url: data.custom_notification_url && data.custom_notification_url.trim() !== '' ? data.custom_notification_url : null,

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
      .channel('new-orders-sound-notification') // Changed channel name to ensure uniqueness
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔔 Novo pedido recebido (Realtime):', payload);
          
          // Force reload of settings to ensure fresh state if needed, or rely on state
          // We rely on state 'enabled' here. 
          
          if (enabled) {
            // Reproduzir som de notificação
            try {
              console.log(`🎵 Tentando reproduzir som: ${soundType}`);
              // Use a slight delay to ensure browser interaction policies are met if possible, 
              // or just fire away.
              await soundNotifications.playSound(soundType);
              console.log('✅ Som reproduzido com sucesso');
            } catch (error) {
              console.error('❌ Erro ao reproduzir som:', error);
            }
          }

          // Mostrar toast
          toast({
            title: "Novo Pedido!",
            description: `Pedido #${payload.new.order_number} recebido`,
            duration: 10000, // Longer duration
          });
        }
      )
      .subscribe((status) => {
        console.log(`📡 Status da subscrição de notificações: ${status}`);
      });

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