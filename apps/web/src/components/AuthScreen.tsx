import { DEFAULT_AVATAR, checkNickname, type AvatarConfig, type Me } from "@hc/shared";
import { useState, type FormEvent } from "react";
import { api } from "../api.js";
import { AvatarPicker } from "./Avatar.js";

export function AuthScreen({ onSignedIn, onBrowse }: { onSignedIn: (me: Me) => void; onBrowse: () => void }) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nickCheck = nickname ? checkNickname(nickname) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me =
        mode === "register"
          ? await api<Me>("POST", "/api/auth/register", { email, password, nickname, avatar, confirmAdult: adult })
          : await api<Me>("POST", "/api/auth/login", { email, password });
      onSignedIn(me);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="hero">
        <h1>Hustle City</h1>
        <p className="muted">Run a shop in Junction 101, meet people, and discover real Lagos businesses.</p>
        <button className="btn ghost" onClick={onBrowse}>
          Just browse the marketplace →
        </button>
      </div>

      <form className="card stack" onSubmit={(e) => void submit(e)}>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" className="btn sm" aria-selected={mode === "register"} onClick={() => setMode("register")}>
            Create account
          </button>
          <button type="button" role="tab" className="btn sm" aria-selected={mode === "login"} onClick={() => setMode("login")}>
            Sign in
          </button>
        </div>

        <label className="field">
          Email
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input
            className="input"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={mode === "register" ? 10 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "register" && <span className="small muted">At least 10 characters.</span>}
        </label>

        {mode === "register" && (
          <>
            <label className="field">
              Nickname
              <input className="input" required value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />
              {nickCheck && !nickCheck.ok && <span className="error">{nickCheck.reason}</span>}
            </label>
            <AvatarPicker value={avatar} onChange={setAvatar} />
            <label className="row small">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} required />I confirm I am 18 or older.
            </label>
            <p className="small muted">
              You start with 2,000 City Coins. City Coins are for the game only — they have no cash value and can't be withdrawn.
            </p>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" type="submit" disabled={busy || (mode === "register" && (!adult || (nickCheck !== null && !nickCheck.ok)))}>
          {mode === "register" ? "Enter Junction 101" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
