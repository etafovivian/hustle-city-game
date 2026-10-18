// Password screens: a field with show/hide, setting a new password from a reset link, and changing it in the Phone.
import { passwordProblem } from "@hc/shared";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api.js";

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: string;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <input
          className="input has-reveal"
          type={reveal ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="reveal" onClick={() => setReveal((r) => !r)} aria-label={reveal ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
          {reveal ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </span>
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

/** Shared rules for a new password and its confirmation. */
export function newPasswordProblem(password: string, confirm: string): string | null {
  const problem = passwordProblem(password);
  if (problem) return problem;
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}

/** Opened from a one-time reset link (?reset=…). */
export function ResetPassword({ token, onDone }: { token: string; onDone: (msg: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = newPasswordProblem(password, confirm);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await api("POST", "/api/auth/reset", { token, newPassword: password });
      onDone("Password changed. Sign in with your new password.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="reset-page">
      <form className="reset-card stack" onSubmit={submit}>
        <span className="dream-icon lg" aria-hidden="true">
          <KeyRound size={28} />
        </span>
        <h1 style={{ fontSize: 26 }}>Choose a new password</h1>
        <p className="small muted">This link works once. You'll be signed out on every device, then you can sign in with the new password.</p>
        <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 6 characters." />
        <PasswordField label="Type it again" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {error && (
          <p className="alert" role="alert">
            <AlertCircle size={18} aria-hidden="true" /> {error}
          </p>
        )}
        <button className="btn primary block cta" type="submit" disabled={busy}>
          {busy ? "One moment…" : "Save new password"}
        </button>
      </form>
    </main>
  );
}

/** Phone → Account: change password while signed in. */
export function ChangePassword({ email, notify }: { email: string; notify: (msg: string) => void }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = newPasswordProblem(password, confirm);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await api("POST", "/api/auth/password", { currentPassword: current, newPassword: password });
      setDone(true);
      setCurrent("");
      setPassword("");
      setConfirm("");
      notify("Password changed");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack account-form" onSubmit={submit}>
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>Account</h2>
        <p className="small muted">Signed in as {email}</p>
      </div>
      {/* Lets password managers pair the new password with this account. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 6 characters. Other devices get signed out." />
      <PasswordField label="Type the new one again" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {error && (
        <p className="alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      )}
      {done && !error && (
        <p className="notice small">
          <CheckCircle2 size={16} aria-hidden="true" /> Password changed. Other devices were signed out.
        </p>
      )}
      <button className="btn primary block" type="submit" disabled={busy}>
        {busy ? "One moment…" : "Change password"}
      </button>
    </form>
  );
}
