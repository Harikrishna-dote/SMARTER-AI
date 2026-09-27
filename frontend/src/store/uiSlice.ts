import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { ThemeMode } from '../lib/types';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'success' | 'error' | 'info';
  duration?: number;
}

interface UiState {
  theme: ThemeMode;
  sidebarOpen: boolean;
  commandOpen: boolean;
  toasts: Toast[];
  reducedMotion: boolean;
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = (localStorage.getItem('smarterai.theme') as ThemeMode | null) ?? 'system';
  return stored ?? 'system';
}

const initialState: UiState = {
  theme: getInitialTheme(),
  sidebarOpen: false,
  commandOpen: false,
  toasts: [],
  reducedMotion:
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.theme = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebar(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    setCommandOpen(state, action: PayloadAction<boolean>) {
      state.commandOpen = action.payload;
    },
    toggleCommand(state) {
      state.commandOpen = !state.commandOpen;
    },
    pushToast: {
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts.push(action.payload);
      },
      prepare(toast: Omit<Toast, 'id'>) {
        return { payload: { id: nanoid(), duration: 4000, ...toast } };
      },
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  setSidebar,
  setCommandOpen,
  toggleCommand,
  pushToast,
  dismissToast,
} = uiSlice.actions;
export default uiSlice.reducer;
