import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const TOKEN_KEY = "tripin_token";

function formatApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x)))
      .join(", ");
  }
  return fallback;
}

export type RegisterPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
};

type AuthContextValue = {
  token: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Creates account only — does not log in. User must sign in on /login. */
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [ready, setReady] = useState(!localStorage.getItem(TOKEN_KEY));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setEmail(null);
    setFirstName(null);
    setLastName(null);
    setReady(true);
  }, []);

  const loadMe = useCallback(async (t: string) => {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      logout();
      return;
    }
    const data = (await res.json()) as {
      email: string;
      first_name?: string | null;
      last_name?: string | null;
    };
    setEmail(data.email);
    setFirstName(data.first_name?.trim() || null);
    setLastName(data.last_name?.trim() || null);
    setReady(true);
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setEmail(null);
      setFirstName(null);
      setLastName(null);
      setReady(true);
      return;
    }
    setReady(false);
    loadMe(token).catch(() => logout());
  }, [token, loadMe, logout]);

  const login = useCallback(async (e: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, "Login failed"));
    }
    const data = (await res.json()) as { access_token: string };
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setReady(false);
    await loadMe(data.access_token);
  }, [loadMe]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        first_name: payload.first_name,
        last_name: payload.last_name,
        date_of_birth: payload.date_of_birth,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, "Sign up failed"));
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      email,
      firstName,
      lastName,
      ready,
      login,
      register,
      logout,
    }),
    [token, email, firstName, lastName, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
