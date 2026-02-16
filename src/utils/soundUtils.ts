// Utility functions for sound notifications using HTML5 Audio
export class SoundNotifications {
  private isEnabled: boolean = true;
  private volume: number = 0.8;
  private audioFiles: Map<string, HTMLAudioElement> = new Map();
  private customSoundUrls: Map<string, string> = new Map();
  private currentlyPlaying: Set<HTMLAudioElement> = new Set();
  private audioContext: AudioContext | null = null;
  private unlocked: boolean = false;

  constructor() {
    this.preloadSounds();
  }

  setCustomSoundUrls(customUrls: { [key: string]: string | null }) {
    console.log('🔧 SOUND UTILS - Configurando URLs personalizadas:', customUrls);
    this.customSoundUrls.clear();
    
    Object.entries(customUrls).forEach(([key, url]) => {
      if (url) {
        // Converter custom_bell_url para bell, etc.
        const soundType = key.replace('custom_', '').replace('_url', '');
        this.customSoundUrls.set(soundType, url);
        console.log(`✅ SOUND UTILS - URL personalizada configurada: ${soundType} -> ${url}`);
      }
    });
    
    console.log('🔧 SOUND UTILS - URLs personalizadas ativas:', 
      Array.from(this.customSoundUrls.entries()));
    
    // Recarregar sons com as novas URLs
    this.preloadSounds();
  }

  private preloadSounds() {
    // Limpar áudios existentes
    this.audioFiles.clear();
    
    const sounds = [
      { name: 'bell', path: '/sounds/bell.mp3' },
      { name: 'chime', path: '/sounds/chime.mp3' },
      { name: 'notification', path: '/sounds/notification.mp3' },
      { name: 'ding', path: '/sounds/ding.mp3' }
    ];

    sounds.forEach(sound => {
      try {
        // Usar som personalizado se disponível
        const customUrl = this.customSoundUrls.get(sound.name);
        const audioPath = customUrl || sound.path;
        
        const audio = new Audio();
        audio.volume = this.volume;
        audio.preload = 'none'; // Changed to 'none' to avoid loading issues
        audio.loop = false;
        
        // Only set src when we need to play
        this.audioFiles.set(sound.name, audio);
        
        // Adicionar evento para quando o som terminar de tocar
        audio.addEventListener('ended', () => {
          this.currentlyPlaying.delete(audio);
        });
        
        audio.addEventListener('error', (e) => {
          console.warn(`⚠️ Erro ao carregar som ${sound.name}:`, e);
          // Use fallback sound instead of trying to reload
          this.createFallbackSound();
        });
      } catch (error) {
        console.warn(`⚠️ Erro ao criar audio para ${sound.name}:`, error);
      }
    });
  }

  async enableSound() {
    if (!this.isAudioSupported()) {
      throw new Error('Áudio não suportado')
    }

    const audioContext = this.getAudioContext()
    try {
      if (audioContext.state !== 'running') {
        await audioContext.resume()
      }
    } catch (e) {
      this.unlocked = false
      throw e
    }

    try {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.frequency.setValueAtTime(1, audioContext.currentTime)
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.00001, audioContext.currentTime)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.02)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 30))
    } catch {}

    try {
      const audio = this.audioFiles.get('bell')
      if (audio) {
        const prevVolume = audio.volume
        audio.volume = 0
        if (!audio.src) audio.src = this.customSoundUrls.get('bell') || '/sounds/bell.mp3'
        try {
          await audio.play()
          audio.pause()
          audio.currentTime = 0
        } catch {}
        audio.volume = prevVolume
      }
    } catch {}

    if (audioContext.state !== 'running') {
      this.unlocked = false
      throw new Error('Áudio bloqueado pelo navegador')
    }

    this.unlocked = true
  }

  async playSound(soundType: string = 'bell') {
    if (!this.isEnabled) {
      return;
    }

    try {
      if (!this.unlocked) {
        try {
          await this.enableSound()
        } catch {}
      }
      const audio = this.audioFiles.get(soundType);
      
      if (audio) {
        // Set the source only when playing to avoid preloading issues
        const customUrl = this.customSoundUrls.get(soundType);
        const audioPath = customUrl || `/sounds/${soundType}.mp3`;
        

        // Verificar se a URL personalizada é válida antes de usar
        if (customUrl && !this.isValidUrl(customUrl)) {
          console.warn(`⚠️ URL personalizada inválida para ${soundType}: ${customUrl}`);
          // Usar som padrão em vez da URL inválida
          audio.src = `/sounds/${soundType}.mp3`;
        } else if (!audio.src) {

          audio.src = audioPath;
        }
        
        audio.currentTime = 0;
        audio.volume = this.volume;
        this.currentlyPlaying.add(audio);
        

        // Adicionar tratamento de erro específico para carregamento
        audio.onerror = () => {
          console.warn(`⚠️ Erro ao carregar som ${soundType}, usando fallback`);
          this.createFallbackSound();
        };
        

        await audio.play();
      } else {
        this.createFallbackSound();
      }
    } catch (error) {

      console.warn(`⚠️ Erro ao reproduzir som ${soundType}:`, error);

      // Fallback para Web Audio API em caso de erro
      this.createFallbackSound();
    }
  }

  private getAudioContext() {
    if (this.audioContext) return this.audioContext
    this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    return this.audioContext
  }

  private createFallbackSound() {
    try {
      // Fallback usando Web Audio API para sons sintéticos simples
      const audioContext = this.getAudioContext()
      if (audioContext.state !== 'running') {
        try {
          audioContext.resume().catch(() => {})
        } catch {}
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      console.log('✅ Som fallback reproduzido');
    } catch (error) {
      console.error('Erro no fallback de som:', error);
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  setVolume(volume: number | string) {
    // Converter string para número se necessário
    const numVolume = typeof volume === 'string' ? parseFloat(volume) / 100 : volume;
    this.volume = Math.max(0, Math.min(1, numVolume));
    
    // Atualizar volume de todos os áudios carregados
    this.audioFiles.forEach(audio => {
      audio.volume = this.volume;
    });
  }


  private isValidUrl(url: string): boolean {
    try {
      // Verificar se é uma URL válida
      new URL(url);
      return true;
    } catch {
      // Verificar se é um caminho relativo válido
      return url.startsWith('/') || url.startsWith('./') || url.startsWith('../');
    }
  }


  stopSound(soundType: string) {
    console.log(`🔇 SOUND UTILS - Parando som: ${soundType}`);
    
    const audio = this.audioFiles.get(soundType);
    if (audio && this.currentlyPlaying.has(audio)) {
      audio.pause();
      audio.currentTime = 0;
      this.currentlyPlaying.delete(audio);
      console.log(`✅ SOUND UTILS - Som ${soundType} parado`);
    }
  }

  stopAllSounds() {
    console.log(`🔇 SOUND UTILS - Parando todos os sons (${this.currentlyPlaying.size} ativos)`);
    
    this.currentlyPlaying.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    
    this.currentlyPlaying.clear();
    console.log('✅ SOUND UTILS - Todos os sons parados');
  }

  getCurrentlyPlayingCount(): number {
    return this.currentlyPlaying.size;
  }

  isAudioSupported(): boolean {
    return typeof Audio !== 'undefined';
  }

  // Helper específico para cozinha (Sino alto)
  async playKitchenBell() {
    await this.playSound('bell');
  }

  // Helper específico para delivery (Notificação suave)
  async playDeliverySound() {
    await this.playSound('notification');
  }
}

// Singleton instance
export const soundNotifications = new SoundNotifications();
