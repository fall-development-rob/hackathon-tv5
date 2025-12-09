const AUTH_TOKEN_KEY = "media-gateway-auth-token";
const USER_ID_KEY = "media-gateway-user-id";

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  userId: string | null;
}

/**
 * Get the current authentication token from localStorage
 */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (e) {
    console.error("Failed to get auth token:", e);
    return null;
  }
}

/**
 * Get the current user ID from localStorage
 */
export function getUserId(): string | null {
  try {
    return localStorage.getItem(USER_ID_KEY);
  } catch (e) {
    console.error("Failed to get user ID:", e);
    return null;
  }
}

/**
 * Set authentication credentials in localStorage
 */
export function setAuthCredentials(token: string, userId: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(USER_ID_KEY, userId);
  } catch (e) {
    console.error("Failed to set auth credentials:", e);
    throw e;
  }
}

/**
 * Clear authentication credentials from localStorage
 */
export function clearAuthCredentials(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
  } catch (e) {
    console.error("Failed to clear auth credentials:", e);
    throw e;
  }
}

/**
 * Get the current authentication state
 */
export function getAuthState(): AuthState {
  const token = getAuthToken();
  const userId = getUserId();

  return {
    isAuthenticated: !!token && !!userId,
    token,
    userId,
  };
}

/**
 * Check if the user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
