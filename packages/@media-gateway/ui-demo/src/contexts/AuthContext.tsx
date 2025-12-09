import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  authLogin,
  authRegister,
  authMe,
  authLogout,
  setAuthToken,
  APIError,
} from "../lib/api";

const TOKEN_KEY = "media-gateway-token";
const USER_KEY = "media-gateway-user";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt?: string;
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => void;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);

      if (savedToken) {
        setAuthToken(savedToken);
        setToken(savedToken);

        // Try to validate token with /auth/me
        try {
          const response = await authMe();
          const userData: User = {
            ...response.user,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(response.user.name)}&background=random`,
          };
          setUser(userData);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
        } catch (e) {
          // Token invalid, clear auth
          console.warn("Token validation failed, clearing auth:", e);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setAuthToken(null);
          setToken(null);

          // Fallback: use saved user data for offline mode
          if (savedUser) {
            try {
              setUser(JSON.parse(savedUser));
            } catch {
              // Ignore parse error
            }
          }
        }
      } else if (savedUser) {
        // No token but have cached user (offline mode)
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error("Failed to parse saved user:", e);
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Persist user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  // Persist token changes
  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      setAuthToken(token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
    }
  }, [token]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authLogin(email, password);
      const userData: User = {
        ...response.user,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(response.user.name)}&background=random`,
      };

      setToken(response.token);
      setUser(userData);
    } catch (e) {
      const message =
        e instanceof APIError
          ? e.message
          : "Failed to sign in. Please try again.";
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authRegister(email, password, name);
        const userData: User = {
          ...response.user,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
        };

        setToken(response.token);
        setUser(userData);
      } catch (e) {
        const message =
          e instanceof APIError
            ? e.message
            : "Failed to create account. Please try again.";
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await authLogout();
    } catch {
      // Ignore logout errors - we're clearing local state anyway
    }

    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        error,
        signIn,
        signUp,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
