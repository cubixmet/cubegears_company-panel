import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import apiClient from '../api/apiClient';
import { useOffline } from '../pwa/connectivity';
import { forgetVerifiedSession, offlineSessionDeadline, rememberVerifiedSession } from '../pwa/session';

export const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  // Authentication always requires a real account and a valid Django JWT.
  // Optional mock data for other modules must never grant a login session.
  const offline = useOffline();
  const [user, setUser] = useState(readStoredUser);
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('auth_token')));
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('auth_token')));
  const [sessionError, setSessionError] = useState('');
  const [sessionRetryKey, setSessionRetryKey] = useState(0);
  const retrySession = useCallback(() => setSessionRetryKey((key) => key + 1), []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setSessionError('');
      setLoading(false);
      setIsAuthenticated(false);
      setUser(null);
      return;
    }

    if (!navigator.onLine) {
      const stored = readStoredUser();
      const permitted = offlineSessionDeadline(stored) > Date.now();
      setUser(permitted ? stored : null);
      setIsAuthenticated(permitted);
      setSessionError(permitted ? '' : 'Connect to the internet to verify your sign-in.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setSessionError('');

    apiClient.get('/auth/me')
      .then((profile) => {
        if (!active) return;
        const resolvedUser = profile?.user || profile;
        if (!resolvedUser?.id || !(resolvedUser?.phone || resolvedUser?.email)) {
          throw new Error('Unable to verify the account from the Django API.');
        }
        rememberVerifiedSession(resolvedUser);
        setUser(resolvedUser);
        setIsAuthenticated(true);
        setSessionError('');
        localStorage.setItem('auth_user', JSON.stringify(resolvedUser));
      })
      .catch((error) => {
        if (!active) return;
        // A network outage / 5xx response is not proof that a stored JWT
        // expired. Lock the workspace and show Retry without deleting tokens.
        if ([401, 403].includes(error?.status)) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_refresh_token');
          localStorage.removeItem('auth_user');
          forgetVerifiedSession();
          setSessionError('');
        } else {
          setSessionError(error?.message || 'Unable to verify your session. Check your API connection.');
        }
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionRetryKey]);

  // Synchronize multiple open tabs: signing out in one tab also locks the
  // workspace in every other tab. New credentials must revalidate via /auth/me.
  useEffect(() => {
    const syncSession = (event) => {
      if (event.key !== 'auth_token' && event.key !== null) return;
      if (!localStorage.getItem('auth_token')) {
        setUser(null);
        setIsAuthenticated(false);
        setSessionError('');
        setLoading(false);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(true);
        setSessionRetryKey((key) => key + 1);
      }
    };
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, []);

  useEffect(() => {
    if (!offline || !user) return undefined;
    const expire = () => {
      setUser(null);
      setIsAuthenticated(false);
      setSessionError('Your session expired. Connect to the internet to sign in again.');
    };
    const delay = offlineSessionDeadline(user) - Date.now();
    if (!(delay > 0)) {
      expire();
      return undefined;
    }
    const timeout = setTimeout(expire, delay);
    return () => clearTimeout(timeout);
  }, [offline, user]);

  useEffect(() => {
    const reconnect = () => {
      if (!isAuthenticated && localStorage.getItem('auth_token')) retrySession();
    };
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [isAuthenticated, retrySession]);

  const login = async (credentials) => {
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', credentials);
      const token = response?.access || response?.token || response?.accessToken || response?.access_token;
      const refreshToken = response?.refresh || response?.refreshToken || response?.refresh_token;
      const resolvedUser = response?.user || response?.profile;

      if (typeof token !== 'string' || !token ||
          typeof refreshToken !== 'string' || !refreshToken ||
          !resolvedUser?.id || !(resolvedUser?.email || resolvedUser?.phone)) {
        throw new Error('Login response did not include a complete verified user session.');
      }

      // Never retain a refresh token for a different user from a prior session.
      localStorage.removeItem('auth_refresh_token');
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_refresh_token', refreshToken);
      if (resolvedUser) {
        localStorage.setItem('auth_user', JSON.stringify(resolvedUser));
      }

      rememberVerifiedSession(resolvedUser);
      setUser(resolvedUser || null);
      setIsAuthenticated(true);
      setSessionError('');

      return resolvedUser;
    } finally {
      setLoading(false);
    }
  };

  const clearSession = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('auth_user');
    forgetVerifiedSession();
    setUser(null);
    setIsAuthenticated(false);
    setSessionError('');
  }, []);

  const logout = async () => {
    const refresh = localStorage.getItem('auth_refresh_token');
    clearSession();
    if (navigator.onLine) {
      try {
        await apiClient.post('/auth/logout', refresh ? { refresh } : {});
      } catch {
        // The local session is already closed.
      }
    }
  };

  const value = useMemo(
    () => ({ user, isAuthenticated, loading, sessionError, retrySession, login, logout, clearSession, isMockMode: false }),
    [user, isAuthenticated, loading, sessionError, retrySession, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
