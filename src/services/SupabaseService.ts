import { Platform, AppState, AppStateStatus } from 'react-native';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { User, TranslationData } from '../types/types';

// Obtener credenciales de variables de entorno
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

class SupabaseService {
  private client: SupabaseClient | null = null;
  private activeChannel: RealtimeChannel | null = null;
  private isConnected = false;
  private currentRoomCode: string = '';
  private isIntentionalDisconnect = false;
  private reconnectAttempts = 0;
  private localHeartbeatInterval: any = null;
  private _appStateSubscription: any = null;

  private localUser: User | null = null;
  private localParticipants: Map<string, User> = new Map();
  private localCallbacks: {
    onTranslation: (data: TranslationData) => void;
    onParticipantsChange: (users: User[]) => void;
    onStatusChange: (status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR') => void;
    onQuestionControl?: (payload: any) => void;
  } | null = null;

  constructor() {
    this.init();
    if (Platform.OS !== 'web') {
      this._appStateSubscription = AppState.addEventListener('change', this._handleAppStateChange.bind(this));
    }
  }

  private _handleAppStateChange(nextAppState: AppStateStatus) {
    if (nextAppState === 'active' && this.client && this.activeChannel && !this.isConnected) {
      console.log('[SupabaseService] App volvió a primer plano. Reviviendo conexión...');
      if (this.currentRoomCode && this.localUser && this.localCallbacks) {
        this.joinRoom(this.currentRoomCode, this.localUser, this.localCallbacks);
      }
    }
  }

  private init() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          realtime: {
            params: {
              eventsPerSecond: 30,
            },
          },
        });
        console.log('[SupabaseService] ✅ Cliente Supabase inicializado con credenciales.');
        console.log('[SupabaseService] URL:', SUPABASE_URL);
      } catch (error) {
        console.error('[SupabaseService] ❌ Error al inicializar cliente:', error);
      }
    } else {
      console.warn(
        '[SupabaseService] ⚠️ Sin credenciales de Supabase.'
      );
    }
  }

  /**
   * Se une a una sala (vía Supabase Realtime o BroadcastChannel local)
   */
  public joinRoom(
    roomCode: string,
    currentUser: Omit<User, 'joinedAt'>,
    callbacks: {
      onTranslation: (data: TranslationData) => void;
      onParticipantsChange: (users: User[]) => void;
      onStatusChange: (status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR') => void;
      onQuestionControl?: (payload: any) => void;
    }
  ) {
    this.leaveRoom();
    this.isIntentionalDisconnect = false;
    this.currentRoomCode = roomCode;

    const userWithTime: User = { ...currentUser, joinedAt: Date.now() };

    // --- MODO OFFLINE / MOCK ---
    if (!this.client) {
      const { useAppStore } = require('../store/useAppStore');
      useAppStore.getState().addLog(`Sin credenciales. Iniciando modo Offline Local.`, 'warn');
      
      this.isConnected = true;
      this.localCallbacks = callbacks;
      this.localUser = userWithTime;
      this.localParticipants.clear();
      this.localParticipants.set(userWithTime.id, userWithTime);
      callbacks.onParticipantsChange(Array.from(this.localParticipants.values()));
      callbacks.onStatusChange('CONNECTED');

      // Si estamos en Web, usamos BroadcastChannel para simular la sala entre pestañas
      let mockChannel: BroadcastChannel | null = null;
      if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
        mockChannel = new window.BroadcastChannel(`mock-room-${roomCode}`);
        
        mockChannel.onmessage = (event: MessageEvent) => {
          const { type, payload } = event.data;
          if (type === 'participant-join') {
            this.localParticipants.set(payload.user.id, { ...payload.user, lastSeen: Date.now() });
            this.triggerParticipantsChange();
            mockChannel?.postMessage({ type: 'participant-pong', payload: { user: this.localUser } });
          } else if (type === 'participant-pong' || type === 'participant-heartbeat') {
            this.localParticipants.set(payload.user.id, { ...payload.user, lastSeen: Date.now() });
            this.triggerParticipantsChange();
          } else if (type === 'translation') {
            callbacks.onTranslation(payload);
          } else if (type === 'question-control' && callbacks.onQuestionControl) {
            callbacks.onQuestionControl(payload);
          }
        };

        // Anunciar presencia
        mockChannel?.postMessage({ type: 'participant-join', payload: { user: this.localUser } });
      }

      // Heartbeat local para el mock
      let lastIntervalRunMock = Date.now();
      if (this.localHeartbeatInterval) {
        clearInterval(this.localHeartbeatInterval);
        this.localHeartbeatInterval = null;
      }
      this.localHeartbeatInterval = setInterval(() => {
        if (mockChannel && this.localUser) {
          mockChannel.postMessage({ type: 'participant-heartbeat', payload: { user: this.localUser } });
        }
        
        const now = Date.now();
        const delta = now - lastIntervalRunMock;
        lastIntervalRunMock = now;
        let changed = false;
        
        if (delta > 10000) {
          // Si hubo una suspensión (sleep/background), perdonamos a todos
          for (const [id, user] of this.localParticipants.entries()) {
            if (id !== this.localUser?.id) {
              this.localParticipants.set(id, { ...user, lastSeen: now });
            }
          }
        } else {
          for (const [id, user] of this.localParticipants.entries()) {
            const lastSeen = (user as any).lastSeen || now;
            if (id !== this.localUser?.id && (now - lastSeen) > 65000) { 
              this.localParticipants.delete(id);
              changed = true;
            }
          }
        }
        if (changed) this.triggerParticipantsChange();
      }, 5000);

      // Falsificamos activeChannel para que broadcastTranslation y broadcastQuestionControl 
      // utilicen el mockChannel si existe, o modo aislado si es móvil nativo.
      this.activeChannel = {
        send: async (msg: any) => {
          if (mockChannel) {
            mockChannel.postMessage({ type: msg.event, payload: msg.payload });
          } else {
            // Modo Aislado Móvil: No hace nada, solo procesamos nuestra propia voz.
            // Para poder probar la app offline sin que explote.
          }
        },
        unsubscribe: () => {
          if (mockChannel) mockChannel.close();
        },
        untrack: async () => {},
      } as any;

      return;
    }

    // --- MODO ONLINE REAL (Supabase Realtime) ---
    try {
      if (!this.client) {
        callbacks.onStatusChange('ERROR');
        return;
      }

      const { useAppStore } = require('../store/useAppStore');
      useAppStore.getState().addLog(`Intentando conectar a sala: ${roomCode}`, 'info');
      
      callbacks.onStatusChange('CONNECTING');

      const channelName = `realtime-room-${roomCode}`;
      
      this.activeChannel = this.client.channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      });

      this.isConnected = true;
      this.localCallbacks = callbacks;
      this.localUser = userWithTime;
      this.localParticipants.clear();
      this.localParticipants.set(userWithTime.id, userWithTime);
      callbacks.onParticipantsChange(Array.from(this.localParticipants.values()));

      // Configurar Heartbeat/Cleanup de fantasmas
      let lastIntervalRun = Date.now();
      if (this.localHeartbeatInterval) {
        clearInterval(this.localHeartbeatInterval);
        this.localHeartbeatInterval = null;
      }
      this.localHeartbeatInterval = setInterval(() => {
        if (this.activeChannel && this.localUser && this.isConnected && this.client) {
          this.activeChannel.send({
            type: 'broadcast',
            event: 'participant-heartbeat',
            payload: { user: this.localUser }
          }).catch(() => {});
        }
        
        const now = Date.now();
        const delta = now - lastIntervalRun;
        lastIntervalRun = now;
        let changed = false;
        
        if (delta > 10000) {
          // Si el hilo fue bloqueado (sleep/background), dar gracia a todos
          for (const [id, user] of this.localParticipants.entries()) {
            if (id !== this.localUser?.id) {
              this.localParticipants.set(id, { ...user, lastSeen: now });
            }
          }
        } else {
          for (const [id, user] of this.localParticipants.entries()) {
            const lastSeen = (user as any).lastSeen || now;
            if (id !== this.localUser?.id && (now - lastSeen) > 65000) { 
              this.localParticipants.delete(id);
              changed = true;
            }
          }
        }
        if (changed) this.triggerParticipantsChange();
      }, 5000);

      this.activeChannel!
        .on('broadcast', { event: 'participant-join' }, ({ payload }) => {
          if (payload?.user) {
            this.localParticipants.set(payload.user.id, { ...payload.user, lastSeen: Date.now() });
            this.triggerParticipantsChange();
            
            // Responder con nuestro pong para que el nuevo nos vea
            setTimeout(() => {
              if (this.activeChannel && this.localUser && this.isConnected) {
                this.activeChannel.send({
                  type: 'broadcast',
                  event: 'participant-pong',
                  payload: { user: this.localUser }
                }).catch(() => {});
              }
            }, Math.random() * 1000); // jitter
          }
        })
        .on('broadcast', { event: 'participant-pong' }, ({ payload }) => {
          if (payload?.user) {
            this.localParticipants.set(payload.user.id, { ...payload.user, lastSeen: Date.now() });
            this.triggerParticipantsChange();
          }
        })
        .on('broadcast', { event: 'participant-heartbeat' }, ({ payload }) => {
          if (payload?.user) {
            this.localParticipants.set(payload.user.id, { ...payload.user, lastSeen: Date.now() });
            this.triggerParticipantsChange();
          }
        })
        .on('broadcast', { event: 'translation' }, ({ payload }) => {
          callbacks.onTranslation(payload as TranslationData);
        })
        .on('broadcast', { event: 'question-control' }, ({ payload }) => {
          if (callbacks.onQuestionControl) {
            callbacks.onQuestionControl(payload);
          }
        })
        .subscribe(async (status, err) => {
          const { useAppStore } = require('../store/useAppStore');
          
          if (err) {
            useAppStore.getState().addLog(`[SupabaseService] Canal Error: ${err.message}`, 'error');
            console.error('[SupabaseService] Canal Error:', err);
          }

          useAppStore.getState().addLog(`Estado de canal Realtime: ${status}`, status === 'SUBSCRIBED' ? 'info' : 'warn');
          
          if (status === 'SUBSCRIBED') {
            callbacks.onStatusChange('CONNECTED');
            this.reconnectAttempts = 0;
            
            // Anunciar nuestra llegada a los demás
            try {
              await this.activeChannel!.send({
                type: 'broadcast',
                event: 'participant-join',
                payload: { user: this.localUser }
              });
              useAppStore.getState().addLog(`Broadcast de presencia enviado para: ${this.localUser?.role}`, 'info');
            } catch (err: any) {
              useAppStore.getState().addLog(`Error enviando presencia broadcast: ${err.message}`, 'error');
            }
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.isConnected = false;
            
            if (!this.isIntentionalDisconnect) {
              if (this.reconnectAttempts < 20) {
                this.reconnectAttempts++;
                useAppStore.getState().addLog(`Conexión perdida. Intento reconexión ${this.reconnectAttempts}/20`, 'warn');
                callbacks.onStatusChange('CONNECTING');
                
                const delay = this.reconnectAttempts === 1 ? 500 : 3000;
                setTimeout(() => {
                  if (!this.isIntentionalDisconnect && this.currentRoomCode && this.localUser && this.localCallbacks) {
                    this.joinRoom(this.currentRoomCode, this.localUser, this.localCallbacks);
                  }
                }, delay);
              } else {
                useAppStore.getState().addLog(`Se agotaron los intentos de reconexión`, 'error');
                this.isIntentionalDisconnect = true;
                if (this.activeChannel) {
                  try {
                    this.activeChannel.unsubscribe();
                    this.client?.removeChannel(this.activeChannel);
                  } catch (e) {}
                  this.activeChannel = null;
                }
                callbacks.onStatusChange('ERROR');
              }
            } else {
              callbacks.onStatusChange(status === 'CLOSED' ? 'DISCONNECTED' : 'ERROR');
            }
          }
        });

    } catch (error: any) {
      const { useAppStore } = require('../store/useAppStore');
      useAppStore.getState().addLog(`Error crítico al conectar Supabase: ${error.message}`, 'error');
      console.error('[SupabaseService] Error al conectar:', error);
      callbacks.onStatusChange('ERROR');
      this.isConnected = false;
    }
  }

  private triggerParticipantsChange() {
    if (this.localCallbacks) {
      const sortedUsers = Array.from(this.localParticipants.values()).sort(
        (a, b) => a.joinedAt - b.joinedAt
      );
      this.localCallbacks.onParticipantsChange(sortedUsers);
    }
  }

  /**
   * Envía la traducción a todos los participantes
   */
  public async broadcastTranslation(translationData: TranslationData) {
    if (!this.activeChannel || !this.isConnected) {
      console.warn('[SupabaseService] Canal inactivo o desconectado.');
      return;
    }

    try {
      await this.activeChannel.send({
        type: 'broadcast',
        event: 'translation',
        payload: translationData,
      });
    } catch (error) {
      console.error('[SupabaseService] Error en broadcast:', error);
    }
  }

  /**
   * Envía control de preguntas
   */
  public async broadcastQuestionControl(payload: any) {
    if (!this.activeChannel || !this.isConnected) return;

    try {
      await this.activeChannel.send({
        type: 'broadcast',
        event: 'question-control',
        payload,
      });
    } catch (error) {
      console.error('[SupabaseService] Error en broadcastQuestionControl:', error);
    }
  }

  /**
   * Abandona la sala y limpia recursos
   */
  public leaveRoom() {
    this.isIntentionalDisconnect = true;
    this.currentRoomCode = '';
    
    if (this.localHeartbeatInterval) {
      clearInterval(this.localHeartbeatInterval);
      this.localHeartbeatInterval = null;
    }

    // Remover presencia de Supabase Realtime
    if (this.activeChannel && this.isConnected && this.localUser) {
      try {
        this.activeChannel.untrack().catch(() => {});
      } catch (e) {}
    }

    this.localUser = null;
    this.localParticipants.clear();
    this.localCallbacks = null;

    // Limpieza Supabase Realtime
    if (this.activeChannel) {
      try {
        this.activeChannel.unsubscribe();
        this.client?.removeChannel(this.activeChannel);
      } catch (e) {}
      this.activeChannel = null;
    }
    this.isConnected = false;
  }
}

export default new SupabaseService();
