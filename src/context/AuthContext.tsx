import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/index.js';
import { api, SERVER_DISCONNECTED_MESSAGE } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  welcomeUser: User | null;
  clearWelcomeUser: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  serverConnected: boolean;
  serverError: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  checkServerHealth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [welcomeUser, setWelcomeUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [serverConnected, setServerConnected] = useState<boolean>(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const clearWelcomeUser = useCallback(() => {
    setWelcomeUser(null);
  }, []);

  const checkServerHealth = useCallback(async (): Promise<boolean> => {
    try {
      await api.getHealth();
      setServerConnected(true);
      setServerError(null);
      return true;
    } catch {
      setServerConnected(false);
      setServerError(SERVER_DISCONNECTED_MESSAGE);
      return false;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.getMe();
      setUser(response.user);
      setServerConnected(true);
      setServerError(null);
    } catch (err: any) {
      if (err.message === SERVER_DISCONNECTED_MESSAGE) {
        setServerConnected(false);
        setServerError(SERVER_DISCONNECTED_MESSAGE);
      } else {
        api.clearToken();
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    // Periodic health check every 15 seconds (detects real server reachability)
    const interval = setInterval(() => {
      checkServerHealth();
    }, 15000);

    const handleWindowOnline = () => {
      checkServerHealth();
    };

    const handleWindowOffline = () => {
      setServerConnected(false);
      setServerError(SERVER_DISCONNECTED_MESSAGE);
    };

    window.addEventListener('online', handleWindowOnline);
    window.addEventListener('offline', handleWindowOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleWindowOnline);
      window.removeEventListener('offline', handleWindowOffline);
    };
  }, [refreshUser, checkServerHealth]);

  const login = async (username: string, password: string): Promise<User> => {
    try {
      const response = await api.login({ username, password });
      api.setToken(response.token);
      setUser(response.user);
      setWelcomeUser(response.user);
      setServerConnected(true);
      setServerError(null);
      return response.user;
    } catch (err: any) {
      if (err.message === SERVER_DISCONNECTED_MESSAGE) {
        setServerConnected(false);
        setServerError(SERVER_DISCONNECTED_MESSAGE);
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setWelcomeUser(null);
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        welcomeUser,
        clearWelcomeUser,
        isAuthenticated,
        isAdmin,
        isLoading,
        serverConnected,
        serverError,
        login,
        logout,
        refreshUser,
        checkServerHealth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
