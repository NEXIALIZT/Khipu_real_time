import { AppStateCreator, TranslationSlice } from '../storeTypes';
import { LanguageCode, TranslationData } from '../../types/types';
import VoiceService from '../../services/VoiceService';
import TranslationService from '../../services/TranslationService';
import TtsService from '../../services/TtsService';
import NetworkManager from '../../services/NetworkManager';

export const createTranslationSlice: AppStateCreator<TranslationSlice> = (set, get) => ({
  translations: [],
  activeOriginalText: '',
  activeTranslations: {},
  isRecording: false,
  ttsEnabled: true,
  ttsRate: 1.0,
  ttsEngine: 'standard',
  elevenLabsApiKey: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '',
  translationQueue: [],
  isProcessingQueue: false,
  sequenceToken: 0,

  processTranslationQueue: async () => {
    const state = get();
    if (state.isProcessingQueue || state.translationQueue.length === 0) return;

    set({ isProcessingQueue: true });

    while (get().translationQueue.length > 0) {
      const { translationQueue, currentUser, participants, room } = get();
      if (!currentUser || !room) break;
      
      const textToProcess = translationQueue[0];
      
      try {
        const activeLangs = new Set<LanguageCode>();
        activeLangs.add(currentUser.language);
        participants.forEach((p) => {
          if (p.id !== currentUser.id) {
            activeLangs.add(p.language);
          }
        });

        const translationsObj = await TranslationService.translateToMultiple(
          textToProcess,
          currentUser.language,
          Array.from(activeLangs)
        );

        set({ activeTranslations: translationsObj });

        const translationData: TranslationData = {
          senderId: currentUser.id,
          senderName: currentUser.name,
          originalText: textToProcess,
          translations: translationsObj,
          timestamp: Date.now(),
          isFinal: true,
        };

        await NetworkManager.broadcastTranslation(translationData);

        set((state) => {
          const updates: any = {
            translations: [translationData, ...state.translations].slice(0, 100),
          };
          if (state.activeOriginalText === textToProcess) {
            updates.activeOriginalText = '';
            updates.activeTranslations = {};
          }
          return updates;
        });
      } catch (e) {
        console.error('[Store] Error traduciendo en cola:', e);
      } finally {
        set((state) => ({
          translationQueue: state.translationQueue.slice(1)
        }));
      }
    }

    set({ isProcessingQueue: false });
  },

  startRecording: (isQuestion?: boolean) => {
    const { room, currentUser, participants, activeOriginalText, isRecording, setError } = get();
    if (!room || !currentUser || isRecording) return;

    if (room.roomType === 'call' && activeOriginalText.trim().length > 0) {
      setError('El otro usuario está hablando. Espera a que termine.');
      return;
    }

    VoiceService.setLanguage(currentUser.language);
    set({ isRecording: true, error: null, activeOriginalText: '', activeTranslations: {}, translationQueue: [], isProcessingQueue: false });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let latestInterimText = '';

    const getActiveLangs = () => {
      const activeLangs = new Set<LanguageCode>();
      activeLangs.add(currentUser.language);
      const currentParticipants = get().participants;
      currentParticipants.forEach((p) => {
        if (p.id !== currentUser.id) {
          activeLangs.add(p.language);
        }
      });
      return Array.from(activeLangs);
    };

    VoiceService.startListening(
      async (text, isFinal) => {
        set({ activeOriginalText: text });
        latestInterimText = text;

        if (isFinal) {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
          if (text.trim().length === 0) return;

          set((state) => ({ translationQueue: [...state.translationQueue, text] }));
          get().processTranslationQueue();
        } else {
          if (text.trim().length < 3) return;

          if (!debounceTimer) {
            debounceTimer = setTimeout(async () => {
              debounceTimer = null;
              const textToTranslate = latestInterimText;
              if (!textToTranslate || textToTranslate.trim().length < 3) return;

              const currentToken = get().sequenceToken + 1;
              set({ sequenceToken: currentToken });

              try {
                const translationsObj = await TranslationService.translateToMultiple(
                  textToTranslate,
                  currentUser.language,
                  getActiveLangs()
                );
                
                if (currentToken !== get().sequenceToken) {
                  return;
                }
                
                if (get().isRecording) {
                  set({ activeTranslations: translationsObj });

                  const translationData: TranslationData = {
                    senderId: currentUser.id,
                    senderName: currentUser.name,
                    originalText: textToTranslate,
                    translations: translationsObj,
                    timestamp: Date.now(),
                    isFinal: false,
                    isQuestion,
                  };
                  NetworkManager.broadcastTranslation(translationData);
                }
              } catch (error) {
                console.warn('Error en traducción asíncrona:', error);
              }
            }, 400); // 400ms delay para mantener la inmediatez, confiando en los fallbacks si Google bloquea
          }
        }
      },
      (err) => {
        VoiceService.stopListening();
        set({ error: err, isRecording: false });
      }
    );
  },

  stopRecording: () => {
    VoiceService.stopListening();
    set({ isRecording: false });

    const { activeOriginalText, activeTranslations, currentUser, questionState } = get();
    if (activeOriginalText.trim().length > 0 && currentUser) {
      const isQuestion = questionState?.status === 'active' && questionState?.userId === currentUser.id;
      const finalTranslation: TranslationData = {
        senderId: currentUser.id,
        senderName: currentUser.name,
        originalText: activeOriginalText,
        translations: activeTranslations,
        timestamp: Date.now(),
        isFinal: true,
        isQuestion,
      };

      NetworkManager.broadcastTranslation(finalTranslation);

      set((state) => ({
        translations: [finalTranslation, ...state.translations].slice(0, 100),
        activeOriginalText: '',
        activeTranslations: {},
      }));
    }
  },

  sendManualText: async (text) => {
    const { room, currentUser, participants } = get();
    if (!room || !currentUser || !text.trim()) return;

    const activeLangs = new Set<LanguageCode>();
    activeLangs.add(currentUser.language);
    participants.forEach((p) => {
      if (p.id !== currentUser.id) {
        activeLangs.add(p.language);
      }
    });

    const translationsObj = await TranslationService.translateToMultiple(
      text,
      currentUser.language,
      Array.from(activeLangs)
    );

    const translationData: TranslationData = {
      senderId: currentUser.id,
      senderName: currentUser.name,
      originalText: text,
      translations: translationsObj,
      timestamp: Date.now(),
      isFinal: true,
    };

    await NetworkManager.broadcastTranslation(translationData);

    set((state) => {
      const updates: any = {
        translations: [translationData, ...state.translations].slice(0, 100),
      };
      if (state.activeOriginalText === text) {
        updates.activeOriginalText = '';
        updates.activeTranslations = {};
      }
      return updates;
    });
  },

  toggleTts: (enabled) => {
    TtsService.setEnabled(enabled);
    set({ ttsEnabled: enabled });
  },

  changeTtsRate: (rate) => {
    TtsService.setRate(rate);
    set({ ttsRate: rate });
  },

  toggleTtsEngine: (engine) => {
    set({ ttsEngine: engine });
  },

  setElevenLabsApiKey: (key) => {
    set({ elevenLabsApiKey: key });
  },
});
