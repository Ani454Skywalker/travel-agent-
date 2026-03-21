import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const { login, token, email, ready } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";
  if (token && !ready) {
    return (
      <div className="auth-page">
        <p className="auth-sub">Loading…</p>
      </div>
    );
  }
  if (ready && token && email) {
    return <Navigate to="/" replace />;
  }
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(emailInput.trim(), password);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">TRIPIN</p>
        <h1>Log in</h1>
        <p className="auth-sub">
          Your itinerary and travel agent — one account for your trips.
        </p>
        {justRegistered ? (
          <p className="auth-banner auth-banner--ok" role="status">
            Account created. If email is configured, you’ll get a confirmation message.
            Enter your email and password below to open the app.
            <button
              type="button"
              className="auth-banner-dismiss"
              onClick={() => {
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete("registered");
                    return next;
                  },
                  { replace: true },
                );
              }}
            >
              Dismiss
            </button>
          </p>
        ) : null}
        <form onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Log in"}
          </button>
        </form>
        <p className="auth-footer">
          No account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
