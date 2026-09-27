import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';
import { useAppDispatch, useAppSelector } from '../store';
import {
  authFailure,
  authStart,
  authSuccess,
  loggedOut,
  setUser,
} from '../store/authSlice';
import type { LoginRequest, RegisterRequest } from '../lib/types';
import { useToast } from './useToast';

export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, token, status } = useAppSelector((s) => s.auth);

  const login = useCallback(
    async (payload: LoginRequest) => {
      dispatch(authStart());
      try {
        const tokenRes = await api.login(payload);
        setToken(tokenRes.access_token);
        const user = await api.me();
        dispatch(authSuccess({ token: tokenRes.access_token, user }));
        toast({ title: `Welcome back, ${user.full_name.split(' ')[0]}`, variant: 'success' });
      } catch (err) {
        setToken(null);
        const message = err instanceof Error ? err.message : 'Login failed';
        dispatch(authFailure(message));
        toast({ title: 'Login failed', description: message, variant: 'error' });
        throw err;
      }
    },
    [dispatch, toast],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      dispatch(authStart());
      try {
        await api.register(payload);
        const tokenRes = await api.login({ email: payload.email, password: payload.password });
        setToken(tokenRes.access_token);
        const user = await api.me();
        dispatch(authSuccess({ token: tokenRes.access_token, user }));
        toast({ title: 'Account created', description: 'Welcome to SMARTER AI', variant: 'success' });
      } catch (err) {
        setToken(null);
        const message = err instanceof Error ? err.message : 'Registration failed';
        dispatch(authFailure(message));
        toast({ title: 'Registration failed', description: message, variant: 'error' });
        throw err;
      }
    },
    [dispatch, toast],
  );

  const logout = useCallback(() => {
    dispatch(loggedOut());
    toast({ title: 'Signed out', variant: 'info' });
    navigate('/');
  }, [dispatch, navigate, toast]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const user = await api.me();
      dispatch(setUser(user));
    } catch {
      dispatch(loggedOut());
    }
  }, [token, dispatch]);

  return { user, token, status, login, register, logout, refresh };
}
