import SupabaseService from './SupabaseService';
import KhipubaseService from './KhipubaseService';
import { User, TranslationData } from '../types/types';

class NetworkManager {
  private getEngine() {
    // Requerir el store de forma diferida para evitar ciclos de dependencia
    const { useAppStore } = require('../store/useAppStore');
    return useAppStore.getState().networkEngine;
  }

  private getActiveService() {
    const engine = this.getEngine();
    if (engine === 'khipubase' || engine === 'khipubase-cloud') {
      return KhipubaseService;
    }
    return SupabaseService;
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
    const service = this.getActiveService();
    return service.joinRoom(roomCode, currentUser, callbacks);
  }

  public async broadcastTranslation(translationData: TranslationData) {
    const service = this.getActiveService();
    return service.broadcastTranslation(translationData);
  }

  public async broadcastQuestionControl(payload: any) {
    const service = this.getActiveService();
    return service.broadcastQuestionControl(payload);
  }

  public leaveRoom() {
    // Para asegurarnos de que no queden conexiones fantasma, cerramos ambos
    try {
      SupabaseService.leaveRoom();
    } catch (e) {}
    try {
      KhipubaseService.leaveRoom();
    } catch (e) {}
  }
}

export default new NetworkManager();
