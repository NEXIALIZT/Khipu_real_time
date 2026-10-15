import { AppState, AppStateStatus, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { User, TranslationData } from '../types/types';

const LOCAL_URL = process.env.EXPO_PUBLIC_KHIPUBASE_URL || 'http://localhost:3000';
const CLOUD_URL = process.env.EXPO_PUBLIC_KHIPUBASE_CLOUD_URL || 'https://khipubase.onrender.com';

class KhipubaseService {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentRoomCode: string = '';
  private isIntentionalDisconnect = false;
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
    if (Platform.OS !== 'web') {
      this._appStateSubscription = AppState.addEventListener('change', this._handleAppStateChange.bind(this));
    }
  }

  private _handleAppStateChange(nextAppState: AppStateStatus) {
    if (nextAppState === 'active' && this.socket && !this.socket.connected && !this.isIntentionalDisconnect) {
      if (this.currentRoomCode && this.localUser && this.localCallbacks) {
        this.joinRoom(this.currentRoomCode, this.localUser, this.localCallbacks);
      }
    }
  }

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

    this.localCallbacks = callbacks;
    this.localUser = userWithTime;
    this.localParticipants.clear();
    this.localParticipants.set(userWithTime.id, userWithTime);
    callbacks.onParticipantsChange(Array.from(this.localParticipants.values()));
    
    callbacks.onStatusChange('CONNECTING');

    try {
      const { useAppStore } = require('../store/useAppStore');
      const engine = useAppStore.getState().networkEngine;
      const targetUrl = engine === 'khipubase-cloud' ? CLOUD_URL : LOCAL_URL;
      
      this.socket = io(targetUrl, {
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        callbacks.onStatusChange('CONNECTED');
        
        // Unirse a la sala lógica en el servidor
        this.socket?.emit('join-room', roomCode);

        // Enviar evento de presence al resto
        this.socket?.emit('broadcast', {
          roomCode: this.currentRoomCode,
          event: 'participant-join',
          payload: { user: this.localUser }
        });
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        if (reason === 'io server disconnect' || this.isIntentionalDisconnect) {
          callbacks.onStatusChange('DISCONNECTED');
        } else {
          callbacks.onStatusChange('ERROR');
        }
      });

      this.socket.on('connect_error', () => {
        callbacks.onStatusChange('ERROR');
      });

      // Recibir broadcast desde el servidor
      this.socket.on('broadcast', (data: { event: string, payload: any }) => {
        const { event, payload } = data;
        
        if (event === 'participant-join') {
          if (payload?.user) {
            this.localParticipants.set(payload.user.id, { ...payload.user, lastSeen: Date.now() });
            this.triggerParticipantsChange();
            
            // Responder con pong
            setTimeout(() => {
              if (this.socket?.connected && this.localUser) {
                this.socket.emit('broadcast', {
                  roomCode: this.currentRoomCode,
                  event: 'participant-pong',
                  payload: { user: this.localUser }
                });
              }
            }, Math.random() * 1000);
          }
        } else if (event === 'participant-pong' || event === 'participant-heartbeat') {
          if (payload?.user) {
            this.localParticipants.set(payload.user.id, { ...payload.user, lastSeen: Date.now() });
            this.triggerParticipantsChange();
          }
        } else if (event === 'translation') {
          callbacks.onTranslation(payload as TranslationData);
        } else if (event === 'question-control') {
          if (callbacks.onQuestionControl) {
            callbacks.onQuestionControl(payload);
          }
        }
      });

      // Heartbeat local
      let lastIntervalRun = Date.now();
      if (this.localHeartbeatInterval) {
        clearInterval(this.localHeartbeatInterval);
      }
      
      this.localHeartbeatInterval = setInterval(() => {
        if (this.socket?.connected && this.localUser) {
          this.socket.emit('broadcast', {
            roomCode: this.currentRoomCode,
            event: 'participant-heartbeat',
            payload: { user: this.localUser }
          });
        }
        
        const now = Date.now();
        const delta = now - lastIntervalRun;
        lastIntervalRun = now;
        let changed = false;
        
        if (delta > 10000) {
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

    } catch (error) {
      console.error('[Khipubase] Error:', error);
      callbacks.onStatusChange('ERROR');
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

  public async broadcastTranslation(translationData: TranslationData) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('broadcast', {
      roomCode: this.currentRoomCode,
      event: 'translation',
      payload: translationData
    });
  }

  public async broadcastQuestionControl(payload: any) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('broadcast', {
      roomCode: this.currentRoomCode,
      event: 'question-control',
      payload
    });
  }

  public leaveRoom() {
    this.isIntentionalDisconnect = true;
    
    if (this.socket && this.socket.connected) {
      if (this.currentRoomCode) {
        this.socket.emit('leave-room', this.currentRoomCode);
      }
      this.socket.disconnect();
    }
    
    if (this.localHeartbeatInterval) {
      clearInterval(this.localHeartbeatInterval);
      this.localHeartbeatInterval = null;
    }
    
    this.currentRoomCode = '';
    this.socket = null;
    this.isConnected = false;
    this.localUser = null;
    this.localParticipants.clear();
    this.localCallbacks = null;
  }
}

export default new KhipubaseService();
