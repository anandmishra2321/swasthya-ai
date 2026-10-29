import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, WorkspaceItem } from '../types';
import {
  api,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  WORKSPACE_KEY,
  SESSION_EXPIRED_EVENT,
} from '../services/api';

interface AuthContextType {
  user: User | null;
  workspaces: WorkspaceItem[];
  activeWorkspace: WorkspaceItem | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  switchWorkspace: (orgId: string | null) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  workspaces: [],
  activeWorkspace: null,
  token: null,
  isLoading: true,
  login: async () => { throw new Error('Not implemented'); },
  logout: async () => {},
  switchWorkspace: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const activeWorkspace = workspaces.find((w) => w.organizationId === user?.activeWorkspaceId) || null;

  /** Drops every trace of the local session without calling the API. */
  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
    setToken(null);
    setUser(null);
    setWorkspaces([]);
  }, []);

  const refreshUser = async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      clearLocalSession();
      setIsLoading(false);
      return;
    }

    try {
      const res: any = await api.get('/auth/me');
      if (res.success) {
        setUser(res.user);
        setWorkspaces(res.workspaces || []);
      }
    } catch (err) {
      console.warn('[Auth] Failed to refresh user session:', err);
      clearLocalSession();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
    // The API client fires this when a session cannot be recovered by refresh.
    window.addEventListener(SESSION_EXPIRED_EVENT, clearLocalSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, clearLocalSession);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res: any = await api.post('/auth/login', { email, password });
    if (res.success && res.accessToken) {
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      if (res.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
      setToken(res.accessToken);
      setUser(res.user);
      setWorkspaces(res.workspaces || []);

      if (res.user.activeWorkspaceId) {
        localStorage.setItem(WORKSPACE_KEY, res.user.activeWorkspaceId);
      } else {
        localStorage.removeItem(WORKSPACE_KEY);
      }

      return res.user;
    }
    throw new Error('Authentication failed');
  };

  const logout = async (): Promise<void> => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const activeToken = localStorage.getItem(TOKEN_KEY);

    // Clear locally first so the UI never lingers in a signed-in state.
    clearLocalSession();

    if (activeToken && refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken }, { auth: false, headers: { Authorization: `Bearer ${activeToken}` } });
      } catch (err) {
        console.warn('[Auth] Server-side logout failed; local session already cleared.', err);
      }
    }
  };

  const switchWorkspace = async (orgId: string | null) => {
    const res: any = await api.post('/auth/switch-workspace', { organizationId: orgId });
    if (res.success && res.accessToken) {
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      if (res.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
      setToken(res.accessToken);
      if (orgId) {
        localStorage.setItem(WORKSPACE_KEY, orgId);
      } else {
        localStorage.removeItem(WORKSPACE_KEY);
      }
      await refreshUser();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        activeWorkspace,
        token,
        isLoading,
        login,
        logout,
        switchWorkspace,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
