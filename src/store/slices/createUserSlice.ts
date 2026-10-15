import { AppStateCreator, UserSlice } from '../storeTypes';
import { generateRandomId, generateGuestName } from './utils';

export const createUserSlice: AppStateCreator<UserSlice> = (set, get) => ({
  currentUser: null,
  currentScreen: 'Home',
  error: null,
  debugLogs: [],

  addLog: (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    set((state) => ({
      debugLogs: [{ time, msg, type }, ...state.debugLogs].slice(0, 50),
    }));
  },

  clearLogs: () => set({ debugLogs: [] }),
  
  initUser: (name, lang) => {
    const finalName = name.trim() || generateGuestName();
    const newUser = {
      id: generateRandomId(),
      name: finalName,
      role: 'assistant' as const,
      language: lang,
      joinedAt: Date.now(),
    };
    set({ currentUser: newUser, error: null });
  },

  setScreen: (screen) => set({ currentScreen: screen }),
  
  setError: (err) => set({ error: err }),
});
