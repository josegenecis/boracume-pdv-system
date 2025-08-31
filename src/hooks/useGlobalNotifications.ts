import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { soundNotifications } from '@/utils/soundUtils';

export interface GlobalNotificationOrder {
  id: string;
  order_number: string;
  customer_name?: string;
  order_type: string;
  total: number;
  created_at: string;
  acceptance_status?: string;
}

export const useGlobalNotifications = () => {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [latestOrder, setLatestOrder] = useState<GlobalNotificationOrder | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [soundType, setSoundType] = useState('bell');

  useEffect(() => {
    if (!user) return;

    // Carregar configurações de notificação primeiro
    const loadSettings = async () => {
      console.log('🔊 NOTIFICAÇÕES - Carregando configurações para usuário:', user.id);
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.warn('⚠️ NOTIFICAÇÕES - Erro ao carregar configurações:', error);
        return;
      }

      if (data) {
        console.log('📋 NOTIFICAÇÕES - Configurações carregadas:', {
          sound_enabled: data.sound_enabled,
          volume: data.volume,
          order_sound: data.order_sound,
          custom_urls: {
            bell: data.custom_bell_url,
            chime: data.custom_chime_url,
            ding: data.custom_ding_url,
            notification: data.custom_notification_url
          }
        });

        // Atualizar estados locais
        setSoundEnabled(data.sound_enabled);
        setVolume(parseFloat(data.volume || '80') / 100);
        setSoundType(data.order_sound);
        
        // Configurar sons personalizados PRIMEIRO
        const customUrls = {
          custom_bell_url: data.custom_bell_url,
          custom_chime_url: data.custom_chime_url,
          custom_ding_url: data.custom_ding_url,
          custom_notification_url: data.custom_notification_url,
        };
        
        console.log('🔧 NOTIFICAÇÕES - Configurando URLs personalizadas:', customUrls);
        soundNotifications.setCustomSoundUrls(customUrls);
        
        // Depois configurar sistema de som com as configurações carregadas
        soundNotifications.setEnabled(data.sound_enabled);
        soundNotifications.setVolume(parseFloat(data.volume || '80') / 100);
        
        console.log('✅ NOTIFICAÇÕES - Sistema de som configurado com sucesso');
      } else {
        console.log('⚠️ NOTIFICAÇÕES - Nenhuma configuração encontrada, usando padrões');
      }
    };

    // Carregar contagem inicial de pedidos pendentes
    const loadPendingCount = async () => {
      const { data, count } = await supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('acceptance_status', 'pending_acceptance');

      setPendingCount(count || 0);
    };

    loadSettings();
    loadPendingCount();

    // Escutar novos pedidos em tempo real
    const channel = supabase
      .channel('global-notifications-hook')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔔 useGlobalNotifications - Novo pedido recebido:', payload);
          
          const newOrder = payload.new as GlobalNotificationOrder;
          setLatestOrder(newOrder);
          setPendingCount(prev => prev + 1);
          
          // Reproduzir som de notificação
          console.log('🔊 NOTIFICAÇÕES - Tentando reproduzir som:', {
            soundEnabled,
            soundType,
            volume
          });
          
          if (soundEnabled) {
            try {
              await soundNotifications.playSound(soundType);
              console.log('✅ NOTIFICAÇÕES - Som reproduzido com sucesso:', soundType);
            } catch (error) {
              console.error('❌ NOTIFICAÇÕES - Erro ao reproduzir som:', error);
              // Tentar reproduzir som padrão como fallback
              try {
                await soundNotifications.playSound('bell');
                console.log('✅ NOTIFICAÇÕES - Som padrão reproduzido como fallback');
              } catch (fallbackError) {
                console.error('❌ NOTIFICAÇÕES - Erro também no som padrão:', fallbackError);
              }
            }
          } else {
            console.log('🔇 NOTIFICAÇÕES - Som desabilitado');
          }
          
          // Vibração (se suportado)
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          
          // Atualizar título da página
          document.title = `(${pendingCount + 1}) Novo Pedido - Boracumê`;
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedOrder = payload.new as GlobalNotificationOrder;
          
          // Se o pedido foi aceito ou cancelado, decrementar contador
          if (updatedOrder.acceptance_status !== 'pending_acceptance') {
            setPendingCount(prev => Math.max(0, prev - 1));
            
            // Atualizar título da página
            const newCount = Math.max(0, pendingCount - 1);
            if (newCount === 0) {
              document.title = 'Boracumê - Sistema de Gestão';
            } else {
              document.title = `(${newCount}) Pedidos Pendentes - Boracumê`;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Restaurar título original
      document.title = 'Boracumê - Sistema de Gestão';
    };
  }, [user, soundEnabled, volume, soundType, pendingCount]);

  // Atualizar configurações do som quando mudarem
  useEffect(() => {
    soundNotifications.setEnabled(soundEnabled);
    soundNotifications.setVolume(volume);
  }, [soundEnabled, volume]);

  const playTestSound = async () => {
    console.log('🔊 TESTE - Reproduzindo som de teste:', soundType);
    try {
      await soundNotifications.playSound(soundType);
      console.log('✅ TESTE - Som reproduzido com sucesso:', soundType);
    } catch (error) {
      console.error('❌ TESTE - Erro ao reproduzir som:', error);
    }
  };

  const clearNotifications = () => {
    setPendingCount(0);
    setLatestOrder(null);
    document.title = 'Boracumê - Sistema de Gestão';
  };

  return {
    pendingCount,
    latestOrder,
    soundEnabled,
    setSoundEnabled,
    volume,
    setVolume,
    soundType,
    setSoundType,
    playTestSound,
    clearNotifications
  };
};