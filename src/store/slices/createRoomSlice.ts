import { AppStateCreator, RoomSlice } from '../storeTypes';
import { generateRandomId } from './utils';
import NetworkManager from '../../services/NetworkManager';
import TtsService from '../../services/TtsService';
import VoiceService from '../../services/VoiceService';
import TranslationService from '../../services/TranslationService';
import { User, RoomState } from '../../types/types';

export const createRoomSlice: AppStateCreator<RoomSlice> = (set, get) => ({
  room: null,
  connectionStatus: 'DISCONNECTED',
  error: null,
  roomCheckTimeout: null,
  participants: [],
  questionState: {
    status: 'idle',
    userId: null,
    userName: null,
    startTime: null,
  },

  createRoom: async (roomType: 'call' | 'guide' = 'guide') => {
    const { currentUser } = get();
    if (!currentUser) return;

    const hostUser: User = {
      ...currentUser,
      role: roomType === 'call' ? 'caller' : 'host',
    };

    const roomCode = generateRandomId();
    const newRoom: RoomState = {
      code: roomCode,
      hostId: hostUser.id,
      participants: [hostUser],
      roomType,
    };

    set({
      currentUser: hostUser,
      room: newRoom,
      currentScreen: roomType === 'call' ? 'Call' : 'Host',
      connectionStatus: 'CONNECTING',
      translations: [],
      activeOriginalText: '',
      activeTranslations: {},
      questionState: { status: 'idle', userId: null, userName: null, startTime: null },
      ttsEnabled: roomType === 'call' ? true : get().ttsEnabled,
    });

    NetworkManager.joinRoom(
      roomCode,
      hostUser,
      {
        onTranslation: (data) => {
          if (data.senderId === hostUser.id) return;
          const state = get();
          const { room } = state;
          
          const myLang = hostUser.language;
          const sender = state.participants.find(p => p.id === data.senderId);
          const senderLang = sender?.language || 'es';

          const applyUpdates = (finalData: any) => {
            if (finalData.isQuestion || get().room?.roomType === 'call') {
              set((state) => {
                const updates: any = {};
                if (finalData.isFinal !== false) {
                  if (state.activeOriginalText === finalData.originalText) {
                    updates.activeOriginalText = '';
                    updates.activeTranslations = {};
                  }
                  updates.translations = [finalData, ...state.translations].slice(0, 100);
                } else {
                  updates.activeOriginalText = finalData.originalText;
                  updates.activeTranslations = finalData.translations;
                }
                return updates;
              });
            } else {
              if (finalData.isFinal !== false) {
                set((state) => ({
                  translations: [finalData, ...state.translations].slice(0, 100),
                }));
              }
            }

            // Reproducir audio solo si es final y no somos el que lo envió
            if (finalData.isFinal !== false && finalData.senderId !== hostUser.id) {
              const textToSpeak = finalData.translations[myLang];
              if (textToSpeak) {
                TtsService.speak(textToSpeak, myLang);
              }
            }
          };

          // Si falta nuestra traducción (ej. porque el host la envió vacía al detener la grabación) 
          // y el texto no es nuestro, la traducimos localmente como respaldo, SOLO si es final
          if (!data.translations[myLang] && data.originalText && senderLang !== myLang && data.isFinal !== false) {
            applyUpdates(data);
            
            TranslationService.translate(data.originalText, senderLang, myLang).then(localTranslation => {
              const updatedData = { ...data, translations: { ...data.translations, [myLang]: localTranslation } };
              applyUpdates(updatedData);
            }).catch(e => console.warn('Error en traducción local de respaldo (Host):', e));
          } else {
            if (senderLang === myLang) {
              data.translations[myLang] = data.originalText;
            }
            applyUpdates(data);
          }
        },
        onParticipantsChange: (users) => {
          const names = users.map(u => `${u.name}(${u.role})`).join(', ');
          get().addLog(`onParticipantsChange: ${users.length} usuarios -> ${names}`, 'info');
          set({ participants: users });
        },
        onStatusChange: (status) => {
          set({ connectionStatus: status });
          if (status === 'ERROR') {
            set({ error: 'Error al conectar con el servidor en tiempo real.' });
          }
        },
        onQuestionControl: (payload: { type: string, userId?: string, userName?: string }) => {
          const { type, userId, userName } = payload;
          const currentUser = get().currentUser;
          if (!currentUser) return;

          if (type === 'request') {
            set({ questionState: { status: 'pending', userId: userId || null, userName: userName || null, startTime: null } });
          } else if (type === 'approve') {
            set({ questionState: { status: 'active', userId: userId || null, userName: userName || null, startTime: Date.now() } });
          } else if (type === 'reject') {
            set({ questionState: { status: 'idle', userId: null, userName: null, startTime: null } });
          } else if (type === 'end') {
            set({ questionState: { status: 'idle', userId: null, userName: null, startTime: null } });
          }
        },
      }
    );
  },

  joinRoom: (code, expectedType) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const initialType = expectedType || 'guide';

    const assistantUser: User = {
      ...currentUser,
      role: initialType === 'call' ? 'caller' : 'assistant',
    };

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      set({ error: 'El código de sala debe tener 6 caracteres.' });
      return;
    }

    // Si sabemos el tipo (por QR), vamos directo. Si no, esperamos en Home.
    const initialScreen = expectedType ? (initialType === 'call' ? 'Call' : 'Assistant') : 'Home';

    set({
      currentUser: assistantUser,
      room: {
        code: cleanCode,
        hostId: '',
        participants: [assistantUser],
        roomType: initialType,
      },
      currentScreen: initialScreen,
      connectionStatus: 'CONNECTING',
      translations: [],
      activeOriginalText: '',
      activeTranslations: {},
      error: null,
      questionState: { status: 'idle', userId: null, userName: null, startTime: null },
      ttsEnabled: initialType === 'call' ? true : get().ttsEnabled,
    });

    const currentTimeout = get().roomCheckTimeout;
    if (currentTimeout) {
      clearTimeout(currentTimeout);
      set({ roomCheckTimeout: null });
    }

    NetworkManager.joinRoom(
      cleanCode,
      assistantUser,
      {
        onTranslation: (data) => {
          const state = get();
          const currentUser = state.currentUser;
          if (!currentUser) return;

          const myLang = currentUser.language;
          const sender = state.participants.find(p => p.id === data.senderId);
          const senderLang = sender?.language || 'es';

          const applyUpdates = (finalData: any) => {
            set((state) => {
              const updates: any = {};
              if (state.room?.roomType === 'call' || state.room?.roomType === 'guide') {
                if (finalData.isFinal !== false) {
                  if (state.activeOriginalText === finalData.originalText) {
                    updates.activeOriginalText = '';
                    updates.activeTranslations = {};
                  }
                } else {
                  updates.activeOriginalText = finalData.originalText;
                  updates.activeTranslations = finalData.translations;
                }
              }
              if (finalData.isFinal !== false) {
                updates.translations = [finalData, ...state.translations].slice(0, 100);
              }
              return updates;
            });

            // Reproducir audio solo si es final, no somos el que lo envió y hay una traducción
            if (finalData.isFinal !== false && finalData.senderId !== currentUser.id) {
              const textToSpeak = finalData.translations[myLang];
              if (textToSpeak) {
                TtsService.speak(textToSpeak, myLang);
              }
            }
          };

          // Si falta nuestra traducción (ej. porque el host la envió vacía al detener la grabación) 
          // y el texto no es nuestro, la traducimos localmente como respaldo, SOLO si es final
          if (!data.translations[myLang] && data.originalText && senderLang !== myLang && data.isFinal !== false) {
            // Aplicar inmediatamente sin bloquear
            applyUpdates(data);
            
            // Hacer traducción en background
            TranslationService.translate(data.originalText, senderLang, myLang).then(localTranslation => {
              const updatedData = { ...data, translations: { ...data.translations, [myLang]: localTranslation } };
              applyUpdates(updatedData);
            }).catch(e => console.warn('Error en traducción local de respaldo:', e));
          } else {
            if (senderLang === myLang) {
              data.translations[myLang] = data.originalText;
            }
            applyUpdates(data);
          }
        },
        onParticipantsChange: (users) => {
          const names = users.map(u => `${u.name}(${u.role})`).join(', ');
          get().addLog(`onParticipantsChange: ${users.length} usuarios -> ${names}`, 'info');
          set({ participants: users });
          
          const hostUser = users.find(p => p.role === 'host' || p.role === 'caller');
          
          if (hostUser) {
            const currentTimeout = get().roomCheckTimeout;
            if (currentTimeout) {
              clearTimeout(currentTimeout);
              set({ roomCheckTimeout: null });
            }

            // Si estábamos esperando en Home para saber el tipo de sala:
            if (get().currentScreen === 'Home' && get().connectionStatus === 'CONNECTED') {
              const actualRoomType = hostUser.role === 'caller' ? 'call' : 'guide';
              const currentRoom = get().room;
              if (currentRoom) {
                set({
                  room: { ...currentRoom, roomType: actualRoomType },
                  currentUser: { ...get().currentUser!, role: actualRoomType === 'call' ? 'caller' : 'assistant' },
                  currentScreen: actualRoomType === 'call' ? 'Call' : 'Assistant'
                });
              }
            }
            // Si el host cambia el rol dinámicamente o ya estábamos dentro:
            else {
              const currentRoom = get().room;
              if (currentRoom?.roomType === 'guide' && hostUser.role === 'caller') {
                const myUser = get().currentUser;
                if (myUser) {
                  set({
                    room: { ...currentRoom, roomType: 'call' },
                    currentUser: { ...myUser, role: 'caller' },
                    currentScreen: 'Call',
                  });
                }
              }
            }
          }

          // Detectar si el host se fue repentinamente de la sala una vez conectados y dentro de la sala
          if (get().connectionStatus === 'CONNECTED' && get().currentScreen !== 'Home') {
            const hasHostNow = !!hostUser;
            if (!hasHostNow && !get().roomCheckTimeout) {
              const timeout = setTimeout(() => {
                get().leaveRoom();
                set({ 
                  error: 'El guía se ha desconectado o la sala fue cerrada.',
                  currentScreen: 'Home' 
                });
              }, 30000);
              set({ roomCheckTimeout: timeout });
            }
          }
        },
        onStatusChange: (status) => {
          set({ connectionStatus: status });
          
          if (status === 'CONNECTED' && get().currentScreen === 'Home') {
            // Ya nos conectamos al canal, ahora esperamos el ping del host para cambiar de pantalla.
            // Si en 10 segundos no aparece el host, cancelamos.
            if (!get().roomCheckTimeout) {
              const timeout = setTimeout(() => {
                get().leaveRoom();
                set({ error: 'La sala no existe o el anfitrión no está disponible.', currentScreen: 'Home' });
              }, 25000);
              set({ roomCheckTimeout: timeout });
            }
          }
          
          if (status === 'ERROR') {
            const currentTimeout = get().roomCheckTimeout;
            if (currentTimeout) {
              clearTimeout(currentTimeout);
              set({ roomCheckTimeout: null });
            }
            set({ error: 'Error de red. Verifique su conexión.' });
          } else if (status === 'DISCONNECTED') {
            const currentTimeout = get().roomCheckTimeout;
            if (currentTimeout) {
              clearTimeout(currentTimeout);
              set({ roomCheckTimeout: null });
            }
          }
        },
        onQuestionControl: (payload: { type: string, userId?: string, userName?: string }) => {
          const { type, userId, userName } = payload;
          const currentUser = get().currentUser;
          if (!currentUser) return;

          if (type === 'room-closed') {
            get().leaveRoom();
            set({ error: 'El anfitrión ha finalizado y cerrado la sala.', currentScreen: 'Home' });
            return;
          }

          if (type === 'request') {
            set({ questionState: { status: 'pending', userId: userId || null, userName: userName || null, startTime: null } });
          } else if (type === 'approve') {
            set({ questionState: { status: 'active', userId: userId || null, userName: userName || null, startTime: Date.now() } });
            
            if (currentUser.id === userId && currentUser.role === 'assistant') {
              get().startRecording(true);
              // Auto-end after 2 minutes
              setTimeout(() => {
                if (get().questionState.status === 'active' && get().questionState.userId === currentUser.id) {
                  get().endQuestion();
                }
              }, 120000);
            }
          } else if (type === 'reject') {
            set({ questionState: { status: 'idle', userId: null, userName: null, startTime: null } });
          } else if (type === 'end') {
            if (currentUser.id === get().questionState.userId && currentUser.role === 'assistant') {
              get().stopRecording();
            }
            set({ questionState: { status: 'idle', userId: null, userName: null, startTime: null } });
          }
        },
      }
    );
  },

  leaveRoom: () => {
    const { currentUser } = get();
    if (currentUser && (currentUser.role === 'host' || currentUser.role === 'caller')) {
      NetworkManager.broadcastQuestionControl({ type: 'room-closed' });
    }

    VoiceService.stopListening();
    TtsService.stop();
    NetworkManager.leaveRoom();
    
    const currentTimeout = get().roomCheckTimeout;
    if (currentTimeout) {
      clearTimeout(currentTimeout);
      set({ roomCheckTimeout: null });
    }

    set({
      room: null,
      connectionStatus: 'DISCONNECTED',
      participants: [],
      translations: [],
      activeOriginalText: '',
      activeTranslations: {},
      isRecording: false,
      currentScreen: 'Home',
      questionState: { status: 'idle', userId: null, userName: null, startTime: null },
    });
  },

  requestQuestion: () => {
    const { currentUser } = get();
    if (!currentUser) return;
    NetworkManager.broadcastQuestionControl({ type: 'request', userId: currentUser.id, userName: currentUser.name });
    set({ questionState: { status: 'pending', userId: currentUser.id, userName: currentUser.name, startTime: null } });
  },
  approveQuestion: (userId) => {
    const { questionState, isRecording } = get();
    if (isRecording) {
      get().stopRecording();
    }
    NetworkManager.broadcastQuestionControl({ type: 'approve', userId, userName: questionState.userName });
    set({ questionState: { ...questionState, status: 'active', startTime: Date.now() } });
  },
  rejectQuestion: (userId) => {
    NetworkManager.broadcastQuestionControl({ type: 'reject', userId });
    set({ questionState: { status: 'idle', userId: null, userName: null, startTime: null } });
  },
  endQuestion: () => {
    const { currentUser, questionState } = get();
    NetworkManager.broadcastQuestionControl({ type: 'end' });
    if (currentUser?.id === questionState.userId && currentUser?.role === 'assistant') {
      get().stopRecording();
    }
    set({ questionState: { status: 'idle', userId: null, userName: null, startTime: null } });
  },
});
