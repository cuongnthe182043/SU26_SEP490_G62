import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../services/apiClient";
import {
  clearSession,
  getStoredToken,
  getStoredUser,
  saveRememberedEmail,
  saveSession,
} from "../services/storage";

export function useAuthSession() {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return null;
    }

    const currentUser = await apiRequest("/auth/me", { token });
    saveSession({ token, user: currentUser });
    setUser(currentUser);
    return currentUser;
  }, []);

  const setSession = useCallback(({ token, user: nextUser, rememberEmail }) => {
    saveSession({ token, user: nextUser });

    if (rememberEmail !== undefined) {
      saveRememberedEmail(rememberEmail);
    }

    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;

    const hydrateSession = async () => {
      const token = getStoredToken();
      if (!token) {
        if (active) {
          setLoading(false);
        }
        return;
      }

      try {
        await refreshSession();
      } catch {
        clearSession();
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    hydrateSession();

    return () => {
      active = false;
    };
  }, [refreshSession]);

  return {
    user,
    loading,
    setSession,
    refreshSession,
    logout,
  };
}
