import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi } from '../api/auth';

interface User {
  userId: string;
  email: string;
  nickname: string | null;
  avatarUrl: string | null;
  points: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  /** 用 token 获取用户信息 */
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .getMe()
      .then((res) => {
        if (res.ok) setUser(res.data);
        else logout();
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  /** 发送验证码 */
  async function sendCode(email: string) {
    await authApi.sendCode(email);
  }

  /** 验证码登录/注册 */
  async function verifyCode(email: string, code: string) {
    const res = await authApi.verifyCode(email, code);
    const { token: newToken } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    // 获取用户信息
    const me = await authApi.getMe();
    if (me.ok) setUser(me.data);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        sendCode,
        verifyCode,
        logout,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}