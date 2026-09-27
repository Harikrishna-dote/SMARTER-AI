import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../lib/types';
import { getToken, setToken } from '../lib/api';

interface AuthState {
  token: string | null;
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: string | null;
}

const initialState: AuthState = {
  token: typeof window !== 'undefined' ? getToken() : null,
  user: null,
  status: 'idle',
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authStart(state) {
      state.status = 'loading';
      state.error = null;
    },
    authSuccess(state, action: PayloadAction<{ token: string; user: User }>) {
      state.status = 'authenticated';
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.error = null;
      setToken(action.payload.token);
    },
    authFailure(state, action: PayloadAction<string>) {
      state.status = 'error';
      state.error = action.payload;
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    loggedOut(state) {
      state.token = null;
      state.user = null;
      state.status = 'idle';
      state.error = null;
      setToken(null);
    },
  },
});

export const { authStart, authSuccess, authFailure, setUser, loggedOut } = authSlice.actions;
export default authSlice.reducer;
