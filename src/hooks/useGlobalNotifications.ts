import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!user) return;

    // Configurar áudio com tratamento de erro
    const initializeAudio = () => {
      try {
        audioRef.current = new Audio();
        audioRef.current.volume = volume;
        audioRef.current.preload = 'auto';
        
        // Pré-carregar som padrão
        const defaultSound = `/sounds/${soundType}.mp3`;
        audioRef.current.src = defaultSound;
        
        // Adicionar listeners para debugging
        audioRef.current.addEventListener('error', (e) => {
          console.error('Erro ao carregar som:', e);
          console.log('Tentando som:', defaultSound);
        });
        
        audioRef.current.addEventListener('canplay', () => {
          console.log('Som carregado com sucesso:', defaultSound);
        });
        
      } catch (error) {
        console.error('Erro ao inicializar áudio:', error);
      }
    };

    initializeAudio();

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
        (payload) => {
          console.log('🔔 useGlobalNotifications - Novo pedido:', payload);
          
          const newOrder = payload.new as GlobalNotificationOrder;
          setLatestOrder(newOrder);
          setPendingCount(prev => prev + 1);
          
          // Reproduzir som de notificação
          if (soundEnabled && audioRef.current) {
            try {
              const soundUrl = `/sounds/${soundType}.mp3`;
              console.log('🔊 Tentando reproduzir som:', soundUrl);
              
              // Reset áudio para garantir carregamento
              audioRef.current.src = '';
              audioRef.current.load();
              audioRef.current.src = soundUrl;
              audioRef.current.volume = volume;
              audioRef.current.load();
              
              // Tentar reproduzir com timeout
              const playPromise = audioRef.current.play();
              
              if (playPromise !== undefined) {
                playPromise
                  .then(() => {
                    console.log('✅ Som reproduzido com sucesso');
                  })
                  .catch((error) => {
                    console.warn('⚠️ Erro ao reproduzir som:', error.name, error.message);
                    
                    // Tentar com som de fallback
                    if (soundType !== 'notification') {
                      try {
                        audioRef.current!.src = '/sounds/notification.mp3';
                        audioRef.current!.play();
                        console.log('🔄 Usando som de fallback');
                      } catch (fallbackError) {
                        console.error('❌ Fallback também falhou:', fallbackError);
                      }
                    }
                  });
              }
            } catch (error) {
              console.error('❌ Erro crítico ao reproduzir som:', error);
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

  const playTestSound = () => {
    if (audioRef.current) {
      try {
        const soundUrl = `/sounds/${soundType}.mp3`;
        audioRef.current.src = soundUrl;
        audioRef.current.volume = volume;
        
        // Para teste, força permissão de reprodução
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Teste de som executado com sucesso');
            })
            .catch((error) => {
              console.error('Erro no teste de som:', error);
              // Se não conseguir reproduzir, tentar habilitar áudio via interação
              if (error.name === 'NotAllowedError') {
                console.log('Clique em qualquer lugar da página para habilitar som');
              }
            });
        }
      } catch (error) {
        console.error('Erro ao tentar testar som:', error);
      }
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