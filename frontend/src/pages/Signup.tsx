import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Signup() {
  const { signup, token, email, ready } = useAuth();
  const navigate = useNavigate();
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
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      await signup(emailInput.trim(), password);
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
        <p className="auth-brand">tRipin</p>
        <h1>Create account</h1>
        <p className="auth-sub">
          Sign up to plan itineraries and chat with your travel agent.
        </p>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <p className="auth-hint">Use at least 8 characters.</p>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" disabled={pending}>
            {pending ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
