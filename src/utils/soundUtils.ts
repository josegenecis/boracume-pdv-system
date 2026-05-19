// Utility functions for sound notifications using HTML5 Audio
export class SoundNotifications {
  private isEnabled: boolean = true;
  private volume: number = 0.8;
  private audioFiles: Map<string, HTMLAudioElement> = new Map();
  private customSoundUrls: Map<string, string> = new Map();
  private currentlyPlaying: Set<HTMLAudioElement> = new Set();
  private audioContext: AudioContext | null = null;
  private unlocked: boolean = false;
  private persistentAlertTimer: number | null = null;
  private persistentAlertSoundType: string = 'bell';
  private persistentAlertIntervalMs: number = 4000;

  constructor() {
    this.preloadSounds();
  }

  private normalizeSoundType(soundType: string) {
    if (soundType === 'chime' || soundType === 'ding' || soundType === 'notification') {
      return 'chime';
    }
    return 'bell';
  }

  private getDefaultSoundPath(soundType: string) {
    const normalized = this.normalizeSoundType(soundType);
    return normalized === 'chime' ? '/sounds/Bell Instant.mp3' : '/sounds/Alerta Original.mp3';
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
      { name: 'bell', path: this.getDefaultSoundPath('bell') },
      { name: 'chime', path: this.getDefaultSoundPath('chime') },
      { name: 'notification', path: this.getDefaultSoundPath('notification') },
      { name: 'ding', path: this.getDefaultSoundPath('ding') }
    ];

    sounds.forEach(sound => {
      try {
        // Usar som personalizado se disponível
        const customUrl = this.customSoundUrls.get(sound.name);
        const audioPath = customUrl || sound.path;
        
        const audio = new Audio();
        audio.volume = this.volume;
        // Preload minimal metadata so play() can start quickly when needed
        audio.preload = 'metadata';
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
        if (!audio.src) audio.src = this.customSoundUrls.get('bell') || this.getDefaultSoundPath('bell')
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
        const normalizedSoundType = this.normalizeSoundType(soundType);
        const customUrl = this.customSoundUrls.get(normalizedSoundType);
        const audioPath = customUrl || this.getDefaultSoundPath(normalizedSoundType);

        if (customUrl && !this.isValidUrl(customUrl)) {
          console.warn(`⚠️ URL personalizada inválida para ${soundType}: ${customUrl}`);
          audio.src = this.getDefaultSoundPath(normalizedSoundType);
        } else if (!audio.src) {
          audio.src = audioPath;
        }
        
        // Ensure src is set and try to play; if blocked, fallback to WebAudio persistent alert
        if (!audio.src) audio.src = audioPath;
        audio.currentTime = 0;
        audio.volume = this.volume;
        this.currentlyPlaying.add(audio);
        

        // Adicionar tratamento de erro específico para carregamento
        audio.onerror = () => {
          console.warn(`⚠️ Erro ao carregar som ${soundType}, usando fallback`);
          this.createFallbackSound();
        };
        

        try {
          await audio.play();
        } catch (err) {
          console.warn('⚠️ play() blocked, using WebAudio fallback for persistent alerts', err);
          // If play is blocked (autoplay policies), use fallback and start persistent alert
          this.createFallbackSound();
          // Start persistent alert if not already running
          if (this.persistentAlertTimer === null) {
            this.startPersistentAlert(normalizedSoundType, this.persistentAlertIntervalMs);
          }
        }
      } else {
        this.createFallbackSound();
      }
    } catch (error) {

      console.warn(`⚠️ Erro ao reproduzir som ${soundType}:`, error);

      // Fallback para Web Audio API em caso de erro
      this.createFallbackSound();
    }
  }

  startPersistentAlert(soundType: string = 'bell', intervalMs: number = 4000) {
    this.persistentAlertSoundType = soundType;
    this.persistentAlertIntervalMs = Math.max(1500, intervalMs);
    if (this.persistentAlertTimer !== null) return;

    void this.playSound(this.persistentAlertSoundType);
    this.persistentAlertTimer = window.setInterval(() => {
      void this.playSound(this.persistentAlertSoundType);
    }, this.persistentAlertIntervalMs);
  }

  stopPersistentAlert() {
    if (this.persistentAlertTimer !== null) {
      window.clearInterval(this.persistentAlertTimer);
      this.persistentAlertTimer = null;
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
      // Verificar se é um caminho relativo válido ou URL externa sem protocolo (ex: //cdn...)
      return url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || url.startsWith('http');
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
    this.stopPersistentAlert();
    
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
