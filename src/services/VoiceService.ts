import { Platform } from 'react-native';

// Importación segura de expo-speech-recognition para móvil
let ExpoSpeechRecognition: any = null;

if (Platform.OS !== 'web') {
  try {
    ExpoSpeechRecognition = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
  } catch (e) {
    console.warn('[VoiceService] No se pudo cargar expo-speech-recognition:', e);
  }
}

// Mapeo de códigos cortos a locales completos
const LANG_MAP: Record<string, string> = {
  es: 'es-ES',
  en: 'en-US',
  fr: 'fr-FR',
  pt: 'pt-BR',
  it: 'it-IT',
  de: 'de-DE',
  ru: 'ru-RU',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

class VoiceService {
  private isListeningActive = false;
  private onResultCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private webRecognition: any = null;
  private currentLocale = 'es-ES';
  private restartTimer: any = null;
  private accumulatedFinal = '';
  private nativeSubscriptions: any[] = [];
  private silenceTimer: NodeJS.Timeout | null = null;
  private flushSilenceTimer: (() => void) | null = null;

  public engineStatus: 'whisper' | 'native' | 'web' | 'none' = 'none';
  private onEngineStatusCallback: ((status: 'whisper' | 'native' | 'web' | 'none') => void) | null = null;

  public registerEngineStatusCallback(cb: (status: 'whisper' | 'native' | 'web' | 'none') => void) {
    this.onEngineStatusCallback = cb;
    cb(this.engineStatus);
  }

  public unregisterEngineStatusCallback() {
    this.onEngineStatusCallback = null;
  }

  private setEngineStatus(status: 'whisper' | 'native' | 'web' | 'none') {
    this.engineStatus = status;
    if (this.onEngineStatusCallback) this.onEngineStatusCallback(status);
  }

  // Diagnósticos visibles en la UI
  private diagnostics: string[] = [];
  private onDiagnosticsCallback: ((logs: string[]) => void) | null = null;
  private logCapacity = 40;

  private stopPromise: Promise<void> | null = null;
  private lastProcessedWebWordCount: number = 0;

  private logDiagnostic(msg: string) {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMsg = `[${timestamp}] ${msg}`;
    this.diagnostics = [formattedMsg, ...this.diagnostics].slice(0, this.logCapacity);
    console.log(`[VoiceService] ${formattedMsg}`);
    if (this.onDiagnosticsCallback) {
      this.onDiagnosticsCallback(this.diagnostics);
    }
  }

  public registerDiagnosticsCallback(cb: (logs: string[]) => void) {
    this.onDiagnosticsCallback = cb;
    cb(this.diagnostics);
  }

  public getDiagnostics(): string[] {
    return this.diagnostics;
  }

  /**
   * Crea la instancia de SpeechRecognition de la Web (solo en browser).
   */
  private buildWebRecognition(): any {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      this.logDiagnostic('Error: El navegador no soporta SpeechRecognition (usa Chrome)');
      this.onErrorCallback?.('Tu navegador no soporta reconocimiento de voz. Usa Google Chrome.');
      return null;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = this.currentLocale;

    recognition.onstart = () => {
      this.logDiagnostic('Estado: Conectado a Speech Engine Web (Escuchando)');
    };

    recognition.onspeechstart = () => {
      this.logDiagnostic('Estado: Sonido detectado en micrófono');
    };

    recognition.onspeechend = () => {
      this.logDiagnostic('Estado: Sonido pausado/silencio');
    };

    recognition.onresult = (event: any) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      this.logDiagnostic(`Resultado: "${finalText || interimText}" (Final: ${finalText.length > 0})`);

      if (finalText) {
        // finalText contiene toda la frase desde la última pausa.
        // Debemos extraer solo las palabras restantes que no se enviaron en los cortes asíncronos.
        const currentWords = finalText.trim().split(/\s+/).filter(w => w.length > 0);
        const newPart = currentWords.slice(this.lastProcessedWebWordCount).join(' ');

        if (newPart.trim()) {
          this.accumulatedFinal += ' ' + newPart.trim();
        }

        this.lastProcessedWebWordCount = 0; // Reset para la siguiente oración o bloque

        if (this.onResultCallback && this.accumulatedFinal.trim()) {
          this.onResultCallback(this.accumulatedFinal.trim(), true);
          this.accumulatedFinal = '';
        }
      } else if (interimText) {
        // Chunking logic for Web (same as Mobile)
        const currentWords = interimText.trim().split(/\s+/).filter(w => w.length > 0);
        
        if (currentWords.length < this.lastProcessedWebWordCount) {
          this.lastProcessedWebWordCount = 0;
        }

        const newWordsCount = currentWords.length - this.lastProcessedWebWordCount;
        if (newWordsCount > 0) {
          const newPart = currentWords.slice(this.lastProcessedWebWordCount).join(' ');
          const wordCount = newPart.trim().split(/\s+/).length;
          const hasPunctuation = newPart.includes(',') || newPart.includes('.') || newPart.includes('?') || newPart.includes('!');

          if (wordCount >= 8 || hasPunctuation) {
            this.logDiagnostic(`Corte ágil Web (8 palabras o pausa): "${newPart.trim()}"`);
            if (this.onResultCallback) {
              this.onResultCallback(newPart.trim(), true);
            }
            this.lastProcessedWebWordCount += wordCount;
          } else {
            if (this.onResultCallback) {
              this.onResultCallback(newPart.trim(), false);
            }
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      const code = event.error;
      this.logDiagnostic(`Error de motor: "${code}"`);
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        this.isListeningActive = false;
        this.onErrorCallback?.('Permiso del micrófono denegado.');
        return;
      }
      if (code === 'network') {
        this.logDiagnostic('Aviso: Red inestable con el servidor de voz. Reintentando...');
        // No llamamos a onErrorCallback para permitir que onend reinicie automáticamente
        return;
      }
      if (code === 'audio-capture') {
        this.onErrorCallback?.('Sin acceso físico al micrófono.');
        return;
      }
    };

    recognition.onend = () => {
      this.logDiagnostic('Estado: Sesión de micrófono cerrada');
      if (this.isListeningActive) {
        this.logDiagnostic('Reiniciando sesión de micrófono automáticamente...');
        this.restartTimer = setTimeout(() => {
          if (!this.isListeningActive) return;
          try {
            this.webRecognition = this.buildWebRecognition();
            if (this.webRecognition) {
              this.webRecognition.start();
            }
          } catch (e: any) {
            this.logDiagnostic(`Fallo al reiniciar: ${e.message}`);
          }
        }, 100);
      }
    };

    return recognition;
  }

  /**
   * Configura el idioma de entrada.
   */
  public setLanguage(langCode: string) {
    this.currentLocale = LANG_MAP[langCode] ?? langCode;
    this.logDiagnostic(`Idioma configurado a: ${this.currentLocale}`);
  }

  /**
   * Inicia el reconocimiento de voz.
   */
  public async startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ) {
    if (this.stopPromise) {
      this.logDiagnostic('Esperando a que el motor anterior se detenga por completo...');
      await this.stopPromise;
    }

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.flushSilenceTimer = null;

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.isListeningActive = true;
    this.accumulatedFinal = '';
    this.lastProcessedWebWordCount = 0;
    this.logDiagnostic('Solicitando encendido de micrófono...');

    if (Platform.OS === 'web') {
      // ---- MODO WEB: Web Speech API ----
      this.setEngineStatus('web');
      this.webRecognition = this.buildWebRecognition();
      if (!this.webRecognition) return;

      const startTimeout = setTimeout(() => {
        if (this.isListeningActive) {
          const logs = this.getDiagnostics();
          const hasConnected = logs.some(log => log.includes('Conectado'));
          if (!hasConnected) {
            this.logDiagnostic('⚠️ El motor de voz no inició. Abre la app en Chrome/Edge independiente.');
          }
        }
      }, 2500);

      const originalOnStart = this.webRecognition.onstart;
      this.webRecognition.onstart = () => {
        clearTimeout(startTimeout);
        originalOnStart?.();
      };

      try {
        this.webRecognition.start();
      } catch (e: any) {
        clearTimeout(startTimeout);
        this.logDiagnostic(`Excepción al iniciar: ${e.message}`);
        onError(`Fallo de inicio: ${e.message}`);
      }
    } else {
      // ---- MODO MÓVIL: Reconocimiento Nativo de Google/Apple (Homologado a Web) ----
      this.startMobileRecognition(onResult, onError);
    }
  }

  /**
   * Inicia el reconocimiento de voz en Móvil (Android/iOS) usando expo-speech-recognition
   * que se conecta directamente al servicio nativo del sistema operativo (Google SpeechRecognizer),
   * funcionando ágil e instantáneo exactamente igual que la versión web.
   */
  private startMobileRecognition(onResult: (t: string, f: boolean) => void, onError: (e: string) => void) {
    if (!ExpoSpeechRecognition) {
      onError('Reconocimiento de voz nativo no disponible en este dispositivo.');
      return;
    }

    try {
      let lastProcessedWordCount = 0;

      // Limpiar suscripciones previas si existieran para evitar fugas de memoria o múltiples llamadas
      this.nativeSubscriptions.forEach(sub => {
        try { sub.remove(); } catch (err) {}
      });
      this.nativeSubscriptions = [];

      // Solicitar permisos nativos y suscribirse a eventos
      ExpoSpeechRecognition.requestPermissionsAsync().then((result: any) => {
        if (!result.granted) {
          this.isListeningActive = false;
          onError('Permiso del micrófono denegado. Habilítalo en Ajustes del teléfono.');
          return;
        }

        // Suscribirse a resultados del reconocimiento streaming de Android
        const resultSub = ExpoSpeechRecognition.addListener('result', (event: any) => {
          if (!this.isListeningActive) return;
          const fullTranscript = event.results?.[0]?.transcript ?? '';
          const isFinal = event.isFinal ?? false;

          if (fullTranscript) {
            const currentWords = fullTranscript.trim().split(/\s+/).filter((w: string) => w.length > 0);
            
            // FIX: El OS de Android puede limpiar su buffer de transcripción tras una pausa larga sin emitir 'end'
            if (currentWords.length < lastProcessedWordCount) {
              this.logDiagnostic('Buffer nativo reiniciado silenciosamente. Ajustando...');
              lastProcessedWordCount = 0;
            }

            const newWordsCount = currentWords.length - lastProcessedWordCount;

            if (newWordsCount <= 0 && !isFinal) return; // Esperar más palabras

            const newPart = currentWords.slice(lastProcessedWordCount).join(' ');
            const displayTranscript = fullTranscript.trim();

            if (isFinal) {
              if (this.silenceTimer) clearTimeout(this.silenceTimer);
              if (newPart.trim()) {
                this.logDiagnostic(`Resultado Final Móvil: "${newPart.trim()}"`);
                onResult(newPart.trim(), true);
              }
              lastProcessedWordCount = 0; // Reset para la siguiente frase
            } else {
              const wordCount = newPart.trim().split(/\s+/).length;
              const hasPunctuation = newPart.includes(',') || newPart.includes('.') || newPart.includes('?') || newPart.includes('!');

              if (wordCount >= 8 || hasPunctuation) {
                if (this.silenceTimer) {
                  clearTimeout(this.silenceTimer);
                  this.silenceTimer = null;
                }
                this.flushSilenceTimer = null;
                this.logDiagnostic(`Corte ágil (8 palabras o pausa): "${newPart.trim()}"`);
                onResult(newPart.trim(), true);
                lastProcessedWordCount += wordCount;
              } else {
                onResult(newPart.trim(), false);

                if (this.silenceTimer) {
                  clearTimeout(this.silenceTimer);
                  this.silenceTimer = null;
                }
                
                const flush = () => {
                  if (!this.isListeningActive) return;
                  if (newPart.trim()) {
                    this.logDiagnostic(`Corte por silencio corto en móvil: "${newPart.trim()}"`);
                    onResult(newPart.trim(), true);
                    lastProcessedWordCount += wordCount;
                  }
                  this.flushSilenceTimer = null;
                };
                
                this.flushSilenceTimer = flush;

                this.silenceTimer = setTimeout(() => {
                  if (this.flushSilenceTimer) {
                    this.flushSilenceTimer();
                  }
                  this.silenceTimer = null;
                }, 1200);
              }
            }
          }
        });

        const errorSub = ExpoSpeechRecognition.addListener('error', (event: any) => {
          const code = event.error ?? 'unknown';
          this.logDiagnostic(`Error nativo en móvil: "${code}"`);
          
          // Ignoramos 'no-speech', 'aborted', 'network', 'server' y 'client' para auto-reiniciar en el evento 'end'
          if (code !== 'no-speech' && code !== 'aborted' && code !== 'network' && code !== 'server' && code !== 'client') {
            this.isListeningActive = false; // Sincronizar estado interno con UI para que no intente auto-reiniciar
            onError(`Error de voz: ${code}`);
          } else if (code === 'network' || code === 'server' || code === 'client') {
            this.logDiagnostic(`Aviso: Interrupción menor (${code}). Auto-reintentando...`);
          }
        });

        const endSub = ExpoSpeechRecognition.addListener('end', () => {
          this.logDiagnostic('Sesión de micrófono móvil terminada.');
          
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          if (this.flushSilenceTimer) {
            this.flushSilenceTimer();
            this.flushSilenceTimer = null;
          }
          
          lastProcessedWordCount = 0;
          if (this.isListeningActive) {
            this.logDiagnostic('Reiniciando micrófono móvil automáticamente...');
            this.restartTimer = setTimeout(() => {
              if (!this.isListeningActive) return;
              try {
                const startPromise = ExpoSpeechRecognition.start({
                  lang: this.currentLocale,
                  interimResults: true,
                  continuous: true,
                });
                
                // Si el SO deniega el reinicio constante por inactividad, capturamos el fallo async
                if (startPromise && typeof startPromise.catch === 'function') {
                  startPromise.catch((e: any) => {
                    this.logDiagnostic(`Fallo asíncrono al reiniciar: ${e.message}`);
                    this.isListeningActive = false;
                    onError('El micrófono se apagó por inactividad prolongada.');
                  });
                }
              } catch (e: any) {
                this.logDiagnostic(`Fallo síncrono al reiniciar: ${e.message}`);
                this.isListeningActive = false;
                onError('El micrófono se apagó por inactividad prolongada.');
              }
            }, 100); // Reducido a 100ms para eliminar el "micro-corte" perceptible
          }
        });

        this.nativeSubscriptions = [resultSub, errorSub, endSub];

        // Iniciar reconocimiento
        const startPromise = ExpoSpeechRecognition.start({
          lang: this.currentLocale,
          interimResults: true,
          continuous: true,
          androidIntentOptions: {
            EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 60000,
            EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 60000,
            EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 60000
          }
        });
        
        if (startPromise && typeof startPromise.catch === 'function') {
          startPromise.catch((e: any) => {
            this.logDiagnostic(`Fallo asíncrono al iniciar micrófono: ${e.message}`);
            this.isListeningActive = false;
            onError('Error al iniciar el micrófono.');
          });
        }
        
        this.setEngineStatus('native');
        this.logDiagnostic('✅ Motor de voz móvil iniciado (Homologado a velocidad Web).');
      }).catch((e: any) => {
        this.logDiagnostic(`Error solicitando permisos: ${e.message}`);
        this.isListeningActive = false;
        onError('Fallo al solicitar permisos de micrófono.');
      });
    } catch (e: any) {
      this.logDiagnostic(`Error al iniciar micrófono móvil: ${e.message}`);
      onError(`Error al iniciar el micrófono en móvil: ${e.message}`);
    }
  }

  /**
   * Detiene el reconocimiento de voz.
   */
  public stopListening() {
    this.logDiagnostic('Deteniendo micrófono...');
    this.isListeningActive = false;
    this.accumulatedFinal = '';
    this.setEngineStatus('none');

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (Platform.OS === 'web') {
      if (this.webRecognition) {
        try { this.webRecognition.stop(); } catch (e) {}
        this.webRecognition = null;
      }
    } else {
      if (ExpoSpeechRecognition) {
        try {
          ExpoSpeechRecognition.stop();
        } catch (e) {}

        this.nativeSubscriptions.forEach(sub => {
          try { sub.remove(); } catch (err) {}
        });
        this.nativeSubscriptions = [];
      }

      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      this.flushSilenceTimer = null;
    }
  }

  public isListening(): boolean {
    return this.isListeningActive;
  }
}

export default new VoiceService();
