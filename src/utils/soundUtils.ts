// Utility functions for sound notifications using HTML5 Audio
export class SoundNotifications {
  private isEnabled: boolean = true;
  private volume: number = 0.8;
  private audioFiles: Map<string, HTMLAudioElement> = new Map();
  private customSoundUrls: Map<string, string> = new Map();

  constructor() {
    this.preloadSounds();
  }

  setCustomSoundUrls(customUrls: { [key: string]: string | null }) {
    this.customSoundUrls.clear();
    Object.entries(customUrls).forEach(([key, url]) => {
      if (url) {
        // Converter custom_bell_url para bell, etc.
        const soundType = key.replace('custom_', '').replace('_url', '');
        this.customSoundUrls.set(soundType, url);
      }
    });
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
        
        const audio = new Audio(audioPath);
        audio.preload = 'auto';
        audio.volume = this.volume;
        this.audioFiles.set(sound.name, audio);
        
        audio.addEventListener('canplaythrough', () => {
          console.log(`✅ Som ${sound.name} carregado com sucesso ${customUrl ? '(personalizado)' : '(padrão)'}`);
        });
        
        audio.addEventListener('error', (e) => {
          console.warn(`⚠️ Erro ao carregar som ${sound.name}:`, e);
          // Em caso de erro com som personalizado, tentar carregar som padrão
          if (customUrl) {
            console.log(`Tentando carregar som padrão para ${sound.name}`);
            const fallbackAudio = new Audio(sound.path);
            fallbackAudio.preload = 'auto';
            fallbackAudio.volume = this.volume;
            this.audioFiles.set(sound.name, fallbackAudio);
          }
        });
      } catch (error) {
        console.warn(`⚠️ Erro ao criar audio para ${sound.name}:`, error);
      }
    });
  }

  async enableSound() {
    // Para HTML5 Audio, não precisa de contexto especial
    // Apenas verificar se o áudio está funcionando
    return Promise.resolve();
  }

  async playSound(soundType: string = 'bell') {
    if (!this.isEnabled) {
      console.log('Som desabilitado');
      return;
    }

    try {
      const audio = this.audioFiles.get(soundType);
      
      if (audio) {
        // Reset o áudio se já estiver tocando
        audio.currentTime = 0;
        audio.volume = this.volume;
        
        await audio.play();
        console.log(`✅ Som ${soundType} reproduzido com sucesso`);
      } else {
        console.warn(`⚠️ Som ${soundType} não encontrado, usando fallback`);
        this.createFallbackSound();
      }
    } catch (error) {
      console.error('Erro ao reproduzir som:', error);
      // Fallback para Web Audio API em caso de erro
      this.createFallbackSound();
    }
  }

  private createFallbackSound() {
    try {
      // Fallback usando Web Audio API para sons sintéticos simples
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    // Atualizar volume de todos os áudios carregados
    this.audioFiles.forEach(audio => {
      audio.volume = this.volume;
    });
  }

  isAudioSupported(): boolean {
    return typeof Audio !== 'undefined';
  }
}

// Singleton instance
export const soundNotifications = new SoundNotifications();