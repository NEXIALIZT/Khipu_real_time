import { StateCreator } from 'zustand';
import { LanguageCode, User, RoomState, TranslationData, QuestionState } from '../types/types';

export interface LogEntry {
  time: string;
  msg: string;
  type: 'info' | 'warn' | 'error';
}

export interface UserSlice {
  currentUser: User | null;
  currentScreen: ScreenState;
  error: string | null;
  debugLogs: LogEntry[];
  initUser: (name: string, lang: LanguageCode) => void;
  setScreen: (screen: ScreenState) => void;
  setError: (err: string | null) => void;
  addLog: (msg: string, type?: 'info' | 'warn' | 'error') => void;
  clearLogs: () => void;
}

export interface RoomSlice {
  room: RoomState | null;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR';
  participants: User[];
  error: string | null;
  roomCheckTimeout: ReturnType<typeof setTimeout> | null;
  createRoom: (roomType: 'call' | 'guide') => void;
  joinRoom: (code: string, expectedType?: 'call' | 'guide') => void;
  leaveRoom: () => void;
  
  questionState: QuestionState;
  requestQuestion: () => void;
  approveQuestion: (userId: string) => void;
  rejectQuestion: (userId: string) => void;
  endQuestion: () => void;
}

export interface TranslationSlice {
  translations: TranslationData[];
  activeOriginalText: string;
  activeTranslations: { [key in LanguageCode]?: string };
  isRecording: boolean;
  ttsEnabled: boolean;
  ttsRate: number;
  ttsEngine: 'standard' | 'elevenlabs';
  elevenLabsApiKey: string;
  translationQueue: string[];
  isProcessingQueue: boolean;
  sequenceToken: number;

  processTranslationQueue: () => Promise<void>;
  startRecording: (isQuestion?: boolean) => void;
  stopRecording: () => void;
  sendManualText: (text: string) => Promise<void>;
  toggleTts: (enabled: boolean) => void;
  changeTtsRate: (rate: number) => void;
  toggleTtsEngine: (engine: 'standard' | 'elevenlabs') => void;
  setElevenLabsApiKey: (key: string) => void;
}

export type ScreenState = 'Home' | 'Host' | 'Assistant' | 'Call';

export type NetworkEngine = 'supabase' | 'khipubase' | 'khipubase-cloud';

export interface RootState extends UserSlice, RoomSlice, TranslationSlice {
  networkEngine: NetworkEngine;
  setNetworkEngine: (engine: NetworkEngine) => void;
}

export type AppState = RootState;

export type AppStateCreator<T> = StateCreator<AppState, [], [], T>;
