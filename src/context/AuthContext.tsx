import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
  supabaseUrl?: string;
  supabaseKey?: string;
}

export function AuthProvider({ children, supabaseUrl, supabaseKey }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) {
      setIsLoading(false);
      return;
    }

    const savedUser = localStorage.getItem('scheduler_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('scheduler_user');
      }
    }
    setIsLoading(false);
  }, [supabaseUrl, supabaseKey]);

  const login = async (email: string, password: string) => {
    if (!supabaseUrl || !supabaseKey) {
      const mockUser: User = {
        id: 'demo-' + Date.now(),
        email,
        name: email.split('@')[0],
      };
      setUser(mockUser);
      localStorage.setItem('scheduler_user', JSON.stringify(mockUser));
      localStorage.setItem('scheduler_is_authenticated', 'true');
      return { success: true };
    }

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.msg || '登录失败' };
      }

      const userData: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name,
      };

      setUser(userData);
      localStorage.setItem('scheduler_user', JSON.stringify(userData));
      localStorage.setItem('scheduler_access_token', data.access_token);
      localStorage.setItem('scheduler_refresh_token', data.refresh_token);
      localStorage.setItem('scheduler_is_authenticated', 'true');

      return { success: true };
    } catch (error) {
      return { success: false, error: '网络错误' };
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    if (!supabaseUrl || !supabaseKey) {
      const mockUser: User = {
        id: 'demo-' + Date.now(),
        email,
        name: name || email.split('@')[0],
      };
      setUser(mockUser);
      localStorage.setItem('scheduler_user', JSON.stringify(mockUser));
      localStorage.setItem('scheduler_is_authenticated', 'true');
      return { success: true };
    }

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ email, password, options: { data: { name } } }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.msg || '注册失败' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: '网络错误' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('scheduler_user');
    localStorage.removeItem('scheduler_access_token');
    localStorage.removeItem('scheduler_refresh_token');
    localStorage.removeItem('scheduler_is_authenticated');
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('scheduler_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
