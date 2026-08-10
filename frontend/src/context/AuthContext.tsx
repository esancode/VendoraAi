import { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { api, setAccessToken } from '@/services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  tenant?: {
    id?: string;
    name: string;
    onboardingCompleted: boolean;
    plan: string;
    billingStatus: string;
    trialEndsAt?: string | null;
  };
}

export interface AuthState {
  user: User | null;
  tenantId: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (data: { accessToken: string; user: User; tenantId: string }) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    tenantId: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const login = async (data: { accessToken: string; user: Partial<User>; tenantId: string }) => {
    setAccessToken(data.accessToken);
    try {
      const { data: userData } = await api.get('/auth/me');
      setAuthState({
        user: userData,
        tenantId: data.tenantId || userData.tenantId || (userData.tenant && userData.tenant.id),
        accessToken: data.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (e) {
      // Fallback Se falhar o /me
      setAuthState({
        user: data.user as User,
        tenantId: data.tenantId,
        accessToken: data.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore if it fails, we clear local state anyway
    } finally {
      setAccessToken(null);
      setAuthState({
        user: null,
        tenantId: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  useEffect(() => {
    const handleTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      login(data);
    };

    const handleSessionExpired = () => {
      setAccessToken(null);
      setAuthState({
        user: null,
        tenantId: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    };

    window.addEventListener('token_refreshed', handleTokenRefreshed);
    window.addEventListener('session_expired', handleSessionExpired);

    // Initial silent refresh
    const initAuth = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        login(data);
      } catch (error) {
        // No valid session
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();

    return () => {
      window.removeEventListener('token_refreshed', handleTokenRefreshed);
      window.removeEventListener('session_expired', handleSessionExpired);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
