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

    // Configurar sistema de som
    soundNotifications.setEnabled(soundEnabled);
    soundNotifications.setVolume(volume);

    // Carregar configurações de notificação
    const loadSettings = async () => {
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setSoundEnabled(data.sound_enabled);
        setVolume(parseFloat(data.volume) / 100);
        setSoundType(data.order_sound);
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
          console.log('🔔 useGlobalNotifications - Novo pedido:', payload);
          
          const newOrder = payload.new as GlobalNotificationOrder;
          setLatestOrder(newOrder);
          setPendingCount(prev => prev + 1);
          
          // Reproduzir som de notificação usando Web Audio API
          if (soundEnabled) {
            try {
              await soundNotifications.playSound(soundType);
              console.log('✅ Som reproduzido com sucesso via Web Audio API');
            } catch (error) {
              console.error('❌ Erro ao reproduzir som:', error);
            }
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
    try {
      await soundNotifications.playSound(soundType);
      console.log('Teste de som executado com sucesso via Web Audio API');
    } catch (error) {
      console.error('Erro no teste de som:', error);
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