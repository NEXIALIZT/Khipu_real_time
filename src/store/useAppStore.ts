import { create } from 'zustand';
import { AppState } from './storeTypes';
import { createUserSlice } from './slices/createUserSlice';
import { createRoomSlice } from './slices/createRoomSlice';
import { createTranslationSlice } from './slices/createTranslationSlice';

export const useAppStore = create<AppState>()((set, get, api) => ({
  ...createUserSlice(set, get, api),
  ...createRoomSlice(set, get, api),
  ...createTranslationSlice(set, get, api),
  networkEngine: 'supabase',
  setNetworkEngine: (engine) => set({ networkEngine: engine }),
}));
