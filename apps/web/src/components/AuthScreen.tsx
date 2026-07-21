import { DEFAULT_AVATAR, checkNickname, type AvatarConfig, type Me } from "@hc/shared";
import { AlertCircle, ArrowRight, MapPin, Search, Store } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api.js";
import { printUrl } from "../prints.js";
import { AvatarPicker } from "./Avatar.js";
import { Selvedge } from "./ui.js";

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
  const registering = mode === "register";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = registering
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
    <div className="welcome">
      <section className="welcome-cloth" style={{ backgroundImage: printUrl("market") }} aria-label="About Naija Hustle City">
        <div className="welcome-plate">
          <h1>
            Naija <span>Hustle City</span>
          </h1>
          <p>Open your shop in Junction 101, serve customers, clear daily quests, and find real Lagos businesses near you.</p>
          <ul className="welcome-facts">
            <li>
              <Store size={18} aria-hidden="true" /> Run a shop: stock it, price it, collect your takings.
            </li>
            <li>
              <MapPin size={18} aria-hidden="true" /> Walk Market Square, Work Hub and The Hangout.
            </li>
            <li>
              <Search size={18} aria-hidden="true" /> Or skip the game and search real merchants straight away.
            </li>
          </ul>
          <div>
            <button className="btn go" onClick={onBrowse}>
              Browse merchants <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <Selvedge rule="City Coins are game money — no cash value" />
      </section>

      <section className="welcome-form">
        <form className="welcome-form-inner" onSubmit={(e) => void submit(e)}>
          <div className="segmented" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={registering} onClick={() => setMode("register")}>
              New here
            </button>
            <button type="button" role="tab" aria-selected={!registering} onClick={() => setMode("login")}>
              Sign in
            </button>
          </div>

          <div className="stack" style={{ gap: 4 }}>
            <h2>{registering ? "Get your shop in Junction 101" : "Welcome back"}</h2>
            <p className="muted small">
              {registering ? "You start with 2,000 City Coins to stock your shelves." : "Your shop has been open while you were away."}
            </p>
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
              autoComplete={registering ? "new-password" : "current-password"}
              minLength={registering ? 10 : undefined}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {registering && <span className="hint">At least 10 characters.</span>}
          </label>

          {registering && (
            <>
              <label className="field">
                Nickname
                <input className="input" required maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} />
                {nickCheck && !nickCheck.ok ? (
                  <span className="err">{nickCheck.reason}</span>
                ) : (
                  <span className="hint">This is how other players see you. Letters, numbers and _ only.</span>
                )}
              </label>
              <AvatarPicker value={avatar} onChange={setAvatar} />
              <label className="check">
                <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} required />
                <span>I am 18 or older.</span>
              </label>
            </>
          )}

          {error && (
            <p className="alert" role="alert">
              <AlertCircle size={18} aria-hidden="true" /> {error}
            </p>
          )}
          <button
            className="btn primary block"
            type="submit"
            disabled={busy || (registering && (!adult || (nickCheck !== null && !nickCheck.ok)))}
          >
            {busy ? "One moment…" : registering ? "Open my shop" : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
