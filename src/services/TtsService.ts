import { Platform } from 'react-native';
import * as ExpoSpeech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

interface QueuedAudio {
  text: string;
  langCode: string;
  timestamp: number;
}

class TtsService {
  private isTtsEnabled = true;
  private currentRate = 1.0;
  private queue: QueuedAudio[] = [];
  private isPlaying = false;

  constructor() {
    this.init();
  }

  private init() {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.addEventListener('focus', () => {
          try {
            if (window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
            }
          } catch (e) {
            console.warn('[TtsService] focus resume error:', e);
          }
        });
      }
    }
    // Configuración inicial del modo de audio en móvil (mixWithOthers para no bloquear a expo-speech)
    if (Platform.OS !== 'web') {
      setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        allowsRecording: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      }).catch(err => console.warn('[TtsService] Audio mode err:', err));
    }
  }

  public setEnabled(enabled: boolean) {
    this.isTtsEnabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  public setRate(rate: number) {
    this.currentRate = rate;
  }

  public clear() {
    this.queue = [];
    this.stop();
  }

  public stop() {
    this.queue = [];
    this.isPlaying = false;
    if (Platform.OS === 'web') {
      if (window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) { console.warn('[TtsService] cancel error:', e); }
      }
    } else {
      ExpoSpeech.stop();
    }
  }

  public speak(text: string, langCode: string) {
    if (!this.isTtsEnabled || !text || text.trim() === '') {
      return;
    }

    this.queue.push({
      text,
      langCode,
      timestamp: Date.now(),
    });

    this.playNext();
  }

  private playNext() {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    // Descartar segmentos muy antiguos (ej. > 15 segundos)
    const now = Date.now();
    while (this.queue.length > 0 && (now - this.queue[0].timestamp > 15000)) {
      console.log('[TtsService] Descartando segmento antiguo:', this.queue[0].text);
      this.queue.shift();
    }

    if (this.queue.length === 0) return;

    const nextAudio = this.queue.shift();
    if (!nextAudio) return;

    this.isPlaying = true;
    this.executeSpeak(nextAudio.text, nextAudio.langCode);
  }

  private async executeElevenLabsSpeak(text: string, langCode: string, apiKey: string): Promise<boolean> {
    try {
      // Voz multilingüe natural y profesional (George / Rachel - modelo eleven_multilingual_v2)
      const defaultVoiceId = 'JBFqnCBsd6RMkjVDRZzb'; // George
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${defaultVoiceId}?optimize_streaming_latency=3`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          }
        })
      });

      if (!response.ok) {
        console.warn(`[TtsService] Error API ElevenLabs HTTP ${response.status}:`, await response.text());
        return false;
      }

      if (Platform.OS === 'web') {
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new window.Audio(audioUrl);
        
        return new Promise<boolean>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            this.isPlaying = false;
            this.playNext();
            resolve(true);
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            resolve(false);
          };
          audio.play().catch(e => {
            console.warn('[TtsService] Error reproduciendo audio Web (posible bloqueo de autoplay):', e);
            URL.revokeObjectURL(audioUrl);
            this.isPlaying = false;
            this.playNext();
            resolve(false);
          });
        });
      } else {
        const blob = await response.blob();
        if (!blob || blob.size === 0) {
          console.warn('[TtsService] ElevenLabs devolvió blob vacío en móvil');
          return false;
        }

        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = (reader.result as string).split(',')[1];
            resolve(base64data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
        const fileUri = `${cacheDir}elevenlabs_${Date.now()}.mp3`;
        
        await FileSystem.writeAsStringAsync(fileUri, base64String, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Garbage collection manual forzoso
        (base64String as any) = null;
        (blob as any) = null;

        // Verificar integridad del archivo MP3 guardado
        try {
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          if (!fileInfo.exists || (fileInfo as any).size < 100) {
            console.warn('[TtsService] Error al escribir MP3 o archivo muy pequeño:', fileInfo);
            return false;
          }
        } catch (e) {
          console.warn('[TtsService] getInfoAsync error:', e);
        }

        // Despertar el altavoz y solicitar foco transitorio con ducking para asegurar volumen en móvil
        try {
          await setIsAudioActiveAsync(true);
          await setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
            allowsRecording: true,
            shouldPlayInBackground: false,
            shouldRouteThroughEarpiece: false,
          });
        } catch (e) {
          console.warn('[TtsService] setIsAudioActiveAsync error:', e);
        }

        const player = createAudioPlayer(fileUri);
        try { player.volume = 1.0; } catch (e) { console.warn('[TtsService] volume error:', e); }
        let hasStartedPlaying = false;
        
        return new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('[TtsService] Timeout de reproducción en móvil para ElevenLabs');
            try { player.remove(); } catch (e) { console.warn('[TtsService] player remove error:', e); }
            FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
            try {
              setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', allowsRecording: true });
            } catch (e) { console.warn('[TtsService] audio mode error:', e); }
            resolve(false);
          }, 15000);

          player.addListener('playbackStatusUpdate', (status: any) => {
            if (status.error) {
              console.warn('[TtsService] Error en reproducción móvil de ElevenLabs:', status.error);
              clearTimeout(timeout);
              try { player.remove(); } catch (e) { console.warn('[TtsService] player remove error:', e); }
              FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
              try {
                setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', allowsRecording: true });
              } catch (e) { console.warn('[TtsService] audio mode error:', e); }
              resolve(false);
            } else if (status.isLoaded) {
              if (!hasStartedPlaying && !status.playing && !status.didJustFinish) {
                hasStartedPlaying = true;
                try { player.play(); } catch (e) { console.warn('[TtsService] player play error:', e); }
              }
              if (status.didJustFinish) {
                clearTimeout(timeout);
                try { player.remove(); } catch (e) { console.warn('[TtsService] player remove error:', e); }
                FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
                try {
                  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', allowsRecording: true });
                } catch (e) { console.warn('[TtsService] audio mode error:', e); }
                this.isPlaying = false;
                this.playNext();
                resolve(true);
              }
            }
          });

          // Encolar reproducción inmediatamente
          try {
            hasStartedPlaying = true;
            player.play();
          } catch (e) { console.warn('[TtsService] init play error:', e); }
        });
      }
    } catch (err: any) {
      console.warn('[TtsService] Excepción al reproducir audio ElevenLabs:', err.message);
      return false;
    }
  }

  private async executeSpeak(text: string, langCode: string) {
    const { useAppStore } = require('../store/useAppStore');
    const store = useAppStore.getState();
    const isElevenLabs = store.ttsEngine === 'elevenlabs';
    const apiKey = store.elevenLabsApiKey?.trim();

    // 1. Si está activado ElevenLabs y hay API Key, intentamos reproducir el audio realista
    if (isElevenLabs && apiKey) {
      const success = await this.executeElevenLabsSpeak(text, langCode, apiKey);
      if (success) return; // Si tuvo éxito, terminamos aquí
      console.warn('[TtsService] ElevenLabs falló o sin créditos. Aplicando fallback automático a motor Estándar...');
    }

    // 2. MODO ESTÁNDAR (o Fallback si falló ElevenLabs)
    // Mapear código corto a locale completo
    const localeMap: Record<string, string> = {
      es: 'es-US', // Español Latino neutral (US/MX)
      en: 'en-US',
      fr: 'fr-FR',
      pt: 'pt-BR',
      it: 'it-IT',
      de: 'de-DE',
      ru: 'ru-RU',
      ja: 'ja-JP',
      zh: 'zh-CN',
    };
    const locale = localeMap[langCode] ?? langCode;

    // Calibración fina de velocidades para los idiomas solicitados
    const optimalRates: Record<string, number> = {
      es: 1.0,
      en: 0.95,
      de: 0.85,
      pt: 0.9,
      fr: 0.85,
      zh: 0.85,
    };
    const tunedBaseRate = optimalRates[langCode] ?? 1.0;
    const finalRate = this.currentRate * tunedBaseRate;

    if (Platform.OS === 'web') {
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          window.speechSynthesis.resume();
        } catch (e) { console.warn('[TtsService] synth error:', e); }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = finalRate;

        if (window.speechSynthesis.getVoices) {
          const voices = window.speechSynthesis.getVoices();
          const langPrefix = langCode.toLowerCase();
          const matchingVoice = voices.find((voice) => {
            const voiceLang = voice.lang.toLowerCase().replace('_', '-');
            return voiceLang.startsWith(langPrefix);
          });
          if (matchingVoice) {
            utterance.voice = matchingVoice;
            utterance.lang = matchingVoice.lang;
          } else {
            utterance.lang = locale;
          }
        } else {
          utterance.lang = locale;
        }

        let watchdog: any = null;
        utterance.onend = () => {
          if (watchdog) clearTimeout(watchdog);
          this.isPlaying = false;
          this.playNext();
        };

        utterance.onerror = (e) => {
          if (watchdog) clearTimeout(watchdog);
          console.warn('[TtsService] Error en reproducción de voz web:', e.error);
          this.isPlaying = false;
          this.playNext();
        };

        window.speechSynthesis.speak(utterance);
        console.log(`[TtsService] Web TTS: "${text}" [${utterance.lang}]`);

        // Watchdog: Workaround para el infame bug de Chrome que congela el TTS permanentemente en textos largos.
        const maxTime = Math.max(15000, text.length * 150);
        watchdog = setTimeout(() => {
          console.warn('[TtsService] Watchdog de TTS Web activado (Chrome bloqueado). Forzando destrabe...');
          try { window.speechSynthesis.cancel(); } catch(e){}
          this.isPlaying = false;
          this.playNext();
        }, maxTime);
      } else {
        this.isPlaying = false;
        this.playNext();
      }
    } else {
      // Usar expo-speech en nativo (Android / iOS) con "Cazador de Voces"
      try {
        const availableVoices = await ExpoSpeech.getAvailableVoicesAsync();
        
        let exactVoiceIdentifier: string | undefined = undefined;
        let matchedVoiceLanguage: string | undefined = undefined;
        const prefix = langCode.toLowerCase();
        
        // Búsqueda dinámica de voz para el idioma
        for (const voice of availableVoices) {
          const vLang = voice.language.toLowerCase().replace('_', '-');
          if (prefix === 'zh' && (vLang.includes('zh') || vLang.includes('cmn'))) {
            exactVoiceIdentifier = voice.identifier;
            matchedVoiceLanguage = voice.language;
            break; // Ideal para chino
          } else if (vLang.startsWith(prefix)) {
            // Guardar el primero que coincida con el prefijo como fallback inicial
            if (!exactVoiceIdentifier) {
              exactVoiceIdentifier = voice.identifier;
              matchedVoiceLanguage = voice.language;
            }
            // Si hay coincidencia perfecta con el locale, sobrescribir y salir
            if (vLang === locale.toLowerCase()) {
              exactVoiceIdentifier = voice.identifier;
              matchedVoiceLanguage = voice.language;
              break; 
            }
          }
        }

        const speakOptions: any = {
          language: matchedVoiceLanguage || locale, // Usar el tag exacto de la voz o fallback
          rate: finalRate,
          onDone: () => {
            this.isPlaying = false;
            this.playNext();
          },
          onStopped: () => {
            this.isPlaying = false;
            this.playNext();
          },
          onError: (error: any) => {
            console.warn(`[TtsService] Error en expo-speech con voz específica para ${locale}:`, error);
            // Si falló usando una voz o configuración específica (muy común en chino/Android),
            // reintentamos inmediatamente en modo estándar simple sin parámetro 'voice'
            if (speakOptions.voice || speakOptions.language !== locale) {
              console.log(`[TtsService] Reintentando expo-speech con idioma estándar '${locale}' sin voz predefinida...`);
              ExpoSpeech.speak(text, {
                language: locale,
                rate: finalRate,
                onDone: () => { this.isPlaying = false; this.playNext(); },
                onStopped: () => { this.isPlaying = false; this.playNext(); },
                onError: (err2: any) => {
                  console.warn(`[TtsService] Error en reintento estándar para ${locale}:`, err2);
                  // Último intento con el código de idioma básico si el locale falló
                  if (locale !== langCode) {
                    ExpoSpeech.speak(text, {
                      language: langCode,
                      rate: finalRate,
                      onDone: () => { this.isPlaying = false; this.playNext(); },
                      onStopped: () => { this.isPlaying = false; this.playNext(); },
                      onError: () => { this.isPlaying = false; this.playNext(); }
                    });
                  } else {
                    this.isPlaying = false;
                    this.playNext();
                  }
                }
              });
            } else {
              this.isPlaying = false;
              this.playNext();
            }
          },
        };

        if (exactVoiceIdentifier) {
          speakOptions.voice = exactVoiceIdentifier;
          console.log(`[TtsService] Cazador TTS: Usando voz '${exactVoiceIdentifier}' (${matchedVoiceLanguage}) para '${langCode}'`);
        }

        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
            allowsRecording: true,
            shouldRouteThroughEarpiece: false,
            shouldPlayInBackground: false,
          });
        } catch (e) {}

        ExpoSpeech.speak(text, speakOptions);
      } catch (err) {
        // Fallback robusto por si getAvailableVoicesAsync falla
        ExpoSpeech.speak(text, {
          language: locale,
          rate: finalRate,
          onDone: () => { this.isPlaying = false; this.playNext(); },
          onStopped: () => { this.isPlaying = false; this.playNext(); },
          onError: () => { this.isPlaying = false; this.playNext(); }
        });
      }
    }
  }
}

export default new TtsService();
