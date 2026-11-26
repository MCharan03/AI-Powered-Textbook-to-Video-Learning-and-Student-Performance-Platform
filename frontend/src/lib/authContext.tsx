import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { api } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, pass: string, role?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUser = async () => {
    try {
      if (api.getToken()) {
        const currentUser = await api.getCurrentUser();
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch {
      api.setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (user?.role === 'admin') {
        document.body.setAttribute('data-portal', 'admin');
        document.body.classList.add('portal-admin', 'theme-admin');
        document.body.classList.remove('portal-learn', 'theme-learn');
      } else {
        document.body.setAttribute('data-portal', 'learn');
        document.body.classList.add('portal-learn', 'theme-learn');
        document.body.classList.remove('portal-admin', 'theme-admin');
      }
    }
  }, [user]);

  const login = async (identifier: string, pass: string, role?: string) => {
    // NOTE: intentionally not toggling the context-level `loading` flag here.
    // Setting it would unmount the active login screen (MainLayout renders a
    // full-screen loader while loading), which resets the form and swallows
    // the error message on failed sign-in attempts. Login pages manage their
    // own button loading state; a successful login re-renders via setUser().
    try {
      await api.login(identifier, pass, role);
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
    document.body.className = 'theme-learn';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
