import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { api } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<void>;
  logout: () => void;
  quickSwitch: (role: UserRole) => Promise<void>;
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

  const login = async (username: string, pass: string) => {
    setLoading(true);
    try {
      await api.login(username, pass);
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

  const quickSwitch = async (role: UserRole) => {
    const passwords: Record<UserRole, { email: string; pass: string }> = {
      admin: { email: 'admin@example.com', pass: 'AdminPass123!' },
      student: { email: 'student@example.com', pass: 'StudentPass123!' },
      teacher: { email: 'teacher@example.com', pass: 'TeacherPass123!' },
      parent: { email: 'parent@example.com', pass: 'ParentPass123!' },
    };
    const cred = passwords[role];
    await login(cred.email, cred.pass);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, quickSwitch }}>
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
