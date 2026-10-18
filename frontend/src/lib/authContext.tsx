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
    if (user?.role === 'admin') {
      document.body.className = 'theme-admin';
    } else {
      document.body.className = 'theme-learn';
    }
  }, [user]);

  const login = async (identifier: string, pass: string, role?: string) => {
    setLoading(true);
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
