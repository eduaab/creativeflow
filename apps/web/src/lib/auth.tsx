import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type User } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (userId: string) => Promise<void>;
  logout: () => void;
}
const Ctx = createContext<AuthState>({ user: null, loading: true, login: async () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);
  const login = async (userId: string) => {
    const r = await api.login(userId);
    setToken(r.token);
    setUser(r.user);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const can = (user: User | null, ...roles: User['role'][]) => !!user && (user.role === 'admin' || roles.includes(user.role));
