export type LanguageCode = 'es' | 'en' | 'fr' | 'pt' | 'it' | 'de' | 'ru' | 'ja' | 'zh';

export interface Language {
  code: LanguageCode;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export type UserRole = 'host' | 'assistant' | 'caller';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  language: LanguageCode;
  joinedAt: number;
  lastSeen?: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  participants: User[];
  roomType: 'call' | 'guide';
}

export interface TranslationData {
  senderId: string;
  senderName: string;
  originalText: string;
  translations: {
    [key in LanguageCode]?: string;
  };
  timestamp: number;
  isFinal?: boolean;
  isQuestion?: boolean;
}

export type QuestionStatus = 'idle' | 'pending' | 'active';

export interface QuestionState {
  status: QuestionStatus;
  userId: string | null;
  userName: string | null;
  startTime: number | null;
}
