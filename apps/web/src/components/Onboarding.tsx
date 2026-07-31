// New-player flow: Look → Hustle → Dream → Shop → Account, one small decision per step,
// with a live preview and a shuffle button. Only the last step talks to the server.
import {
  AVATAR_OPTIONS,
  LOOK_ORDER,
  DEFAULT_AVATAR,
  DREAMS,
  HUSTLES,
  checkNickname,
  checkShopName,
  type AvatarConfig,
  type Me,
} from "@hc/shared";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Coins,
  Eye,
  EyeOff,
  Hammer,
  Shuffle,
  Smartphone,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { dreamIcon } from "./dreamIcons.js";
import { Suspense, lazy, useEffect, useState } from "react";
import { api } from "../api.js";
import { Avatar, AvatarPicker } from "./Avatar.js";
import type { AvatarAction } from "./Avatar3D.js";

// Three.js loads only when onboarding is shown.
const Avatar3D = lazy(() => import("./Avatar3D.js"));

const HUSTLE_ACTION: Record<string, AvatarAction> = {
  trader: "Interact",
  chop: "PickUp_Table",
  gadget: "Idle_Talking_Loop",
  artisan: "Fixing_Kneeling",
};

const STEPS = ["Look", "Hustle", "Dream", "Shop", "Account"] as const;
type Step = (typeof STEPS)[number];

const HUSTLE_ICON: Record<string, LucideIcon> = { trader: Store, chop: UtensilsCrossed, gadget: Smartphone, artisan: Hammer };

/** Rough strength: length and variety. The server only requires 10+ characters. */
function strength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = pw.length >= 10 ? 2 : 1;
  if (pw.length >= 14) score++;
  if (/[^A-Za-z]/.test(pw) && /[A-Za-z]/.test(pw)) score++;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}
const STRENGTH_LABEL = ["", "Too short", "Okay", "Good", "Strong"];

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
const NICK_SUGGESTIONS = ["Lagos_Boss", "Mama_Put", "Oga_Gadget", "Yaba_Plug", "Eko_Hustler", "Sharp_Guy", "Ada_Sells", "Tunde_Fix"];

function ChoiceCard({
  selected,
  onSelect,
  Icon,
  title,
  body,
  foot,
}: {
  selected: boolean;
  onSelect: () => void;
  Icon: LucideIcon;
  title: string;
  body: string;
  foot?: string;
}) {
  return (
    <button type="button" className="choice" aria-pressed={selected} onClick={onSelect}>
      <span className="choice-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="choice-text">
        <strong>{title}</strong>
        <span>{body}</span>
        {foot && <em>{foot}</em>}
      </span>
    </button>
  );
}

export function Onboarding({ onSignedIn, onBrowse }: { onSignedIn: (me: Me) => void; onBrowse: () => void }) {
  const [step, setStep] = useState<Step>("Look");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [hustle, setHustle] = useState(HUSTLES[0]!.key);
  const [dream, setDream] = useState(DREAMS[0]!.key);
  const [shopName, setShopName] = useState("");
  const [shopTouched, setShopTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [no3d, setNo3d] = useState(false);

  const index = STEPS.indexOf(step);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);
  const nickCheck = nickname ? checkNickname(nickname) : null;
  const effectiveShop = shopTouched ? shopName : nickname ? `${nickname}'s Shop` : "";
  const shopCheck = effectiveShop ? checkShopName(effectiveShop) : null;
  const hustleDef = HUSTLES.find((h) => h.key === hustle)!;
  const dreamDef = DREAMS.find((d) => d.key === dream)!;

  const stepError = (): string | null => {
    if (step === "Look") {
      if (!avatar.body) return "Choose man or woman.";
      return !nickname ? "Pick a nickname." : nickCheck && !nickCheck.ok ? nickCheck.reason : null;
    }
    if (step === "Shop") return !shopCheck ? "Name your shop." : !shopCheck.ok ? shopCheck.reason : null;
    if (step === "Account") {
      if (!email.includes("@")) return "Enter your email.";
      if (password.length < 10) return "Use a password of at least 10 characters.";
      if (password !== confirm) return "The two passwords don't match. Type the same password in both boxes.";
      if (!adult) return "Tick to confirm you're 18 or older. Naija Hustle City is for adults.";
    }
    return null;
  };

  const shuffle = () => {
    if (step === "Look") {
      const body = avatar.body ?? pick(AVATAR_OPTIONS.body);
      setAvatar({
        body,
        skinTone: pick(AVATAR_OPTIONS.skinTone),
        // Shuffle within the body's most common looks, so results feel natural.
        hairStyle: pick(LOOK_ORDER[body].hair.slice(0, 5)),
        outfit: pick(LOOK_ORDER[body].outfit.slice(0, 4)),
      });
      if (!nickname) setNickname(pick(NICK_SUGGESTIONS));
    } else if (step === "Hustle") setHustle(pick(HUSTLES).key);
    else if (step === "Dream") setDream(pick(DREAMS).key);
    else if (step === "Shop") {
      setShopTouched(true);
      setShopName(pick(["Mama Put Deluxe", "Sharp Sharp Stores", "Gadget Plug Hub", "Fix Am Fast", "Eko Corner Shop"]));
    }
  };

  const next = async () => {
    const problem = stepError();
    setError(problem);
    if (problem) return;
    if (step !== "Account") {
      setStep(STEPS[index + 1]!);
      return;
    }
    setBusy(true);
    try {
      const me = await api<Me>("POST", "/api/auth/register", {
        email,
        password,
        nickname,
        avatar,
        hustle,
        dream,
        shopName: effectiveShop,
        confirmAdult: adult,
      });
      onSignedIn(me);
    } catch (e) {
      setError((e as Error).message);
      // Send people back to the step their problem belongs to.
      const msg = (e as Error).message.toLowerCase();
      if (msg.includes("nickname")) setStep("Look");
      else if (msg.includes("shop")) setStep("Shop");
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setError(null);
    if (index > 0) setStep(STEPS[index - 1]!);
  };

  return (
    <div className="onboard">
      <div className="onboard-top">
        <button type="button" className="icon-btn" onClick={back} disabled={index === 0} aria-label="Back">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="onboard-title">
          <h2>{step === "Look" ? "Your look" : step === "Hustle" ? "Your hustle" : step === "Dream" ? "Your dream" : step === "Shop" ? "Your shop" : "Save your progress"}</h2>
          <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1} aria-label={`Step ${index + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <i key={s} data-on={i <= index} />
            ))}
          </div>
        </div>
        {step !== "Account" ? (
          <button type="button" className="icon-btn" onClick={shuffle} aria-label="Shuffle this step">
            <Shuffle size={18} aria-hidden="true" />
          </button>
        ) : (
          <span className="icon-btn-spacer" />
        )}
      </div>

      {/* Live preview: who you are so far */}
      <div className="onboard-stage" style={{ backgroundImage: "url(/art/street-scene.webp)" }}>
        <div className="stage-card">
          {no3d ? (
            <Avatar avatar={avatar} size={step === "Look" ? 112 : 76} />
          ) : (
            <Suspense fallback={<Avatar avatar={avatar} size={96} />}>
              <div className="stage-3d">
                <Avatar3D
                  avatar={avatar}
                  height={250}
                  onFail={() => setNo3d(true)}
                  action={
                    step === "Hustle"
                      ? (HUSTLE_ACTION[hustle] ?? "Idle_Loop")
                      : step === "Dream"
                        ? "Dance_Loop"
                        : step === "Shop"
                          ? "PickUp_Table"
                          : step === "Account"
                            ? "Walk_Loop"
                            : "Idle_Loop"
                  }
                />
              </div>
            </Suspense>
          )}
          <div className="stage-meta">
            <strong>{nickname ? `@${nickname}` : "@your_name"}</strong>
            {index >= 1 && <span>{hustleDef.title}</span>}
            {index >= 2 && <span className="gold">Dream: {dreamDef.title}</span>}
            {index >= 3 && effectiveShop && <span>{effectiveShop}</span>}
          </div>
        </div>
      </div>

      <div className="onboard-body">
        {step === "Look" && (
          <>
            <label className="field">
              <span className="field-label">Nickname</span>
              <span className="input-wrap">
                <span className="prefix" aria-hidden="true">
                  @
                </span>
                <input className="input" maxLength={20} placeholder="lagos_baller" autoComplete="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              </span>
              <span className="hint">This is how other players see you. Letters, numbers and _ only.</span>
            </label>
            <AvatarPicker value={avatar} onChange={setAvatar} preview={false} />
          </>
        )}

        {step === "Hustle" && (
          <>
            <p className="muted">How do you make your money in Junction 101?</p>
            <div className="choices">
              {HUSTLES.map((h) => (
                <ChoiceCard
                  key={h.key}
                  selected={hustle === h.key}
                  onSelect={() => setHustle(h.key)}
                  Icon={HUSTLE_ICON[h.key] ?? Briefcase}
                  title={h.title}
                  body={h.pitch}
                  foot={h.starterLabel}
                />
              ))}
            </div>
          </>
        )}

        {step === "Dream" && (
          <>
            <p className="muted">What's your big dream{nickname ? `, @${nickname}` : ""}? Chase it at your own pace.</p>
            <div className="choices">
              {DREAMS.map((d) => (
                <ChoiceCard key={d.key} selected={dream === d.key} onSelect={() => setDream(d.key)} Icon={dreamIcon(d.key)} title={d.title} body={d.goal} />
              ))}
            </div>
          </>
        )}

        {step === "Shop" && (
          <>
            <div className="shop-preview">
              <img src="/art/market-square.webp" alt="" />
              <span className="shop-sign">{effectiveShop || "Your shop"}</span>
            </div>
            <label className="field">
              <span className="field-label">Shop name</span>
              <span className="input-wrap">
                <input
                  className="input"
                  maxLength={30}
                  value={effectiveShop}
                  onChange={(e) => {
                    setShopTouched(true);
                    setShopName(e.target.value);
                  }}
                />
              </span>
              <span className="hint">{hustleDef.starterLabel}, plus 2,000 City Coins to stock up.</span>
            </label>
          </>
        )}

        {step === "Account" && (
          <>
            <p className="coin-line">
              <span className="coin-badge" aria-hidden="true">
                <Coins size={13} />
              </span>
              <span>
                Save {effectiveShop || "your shop"} and your <strong>2,000 City Coins</strong>. City Coins are game money with no cash value.
              </span>
            </p>
            <label className="field">
              <span className="field-label">Email</span>
              <span className="input-wrap">
                <input className="input" type="email" autoComplete="email" placeholder="e.g. ayo@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <span className="input-wrap">
                <input
                  className="input has-reveal"
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="reveal" onClick={() => setReveal((r) => !r)} aria-label={reveal ? "Hide password" : "Show password"}>
                  {reveal ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </span>
              <span className="strength" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                  <i key={i} data-on={i <= strength(password) ? (strength(password) >= 3 ? "1" : "2") : "0"} />
                ))}
              </span>
              <span className="hint">At least 10 characters{password ? ` · ${STRENGTH_LABEL[strength(password)]}` : ""}.</span>
            </label>
            <label className="field">
              <span className="field-label">Type it again</span>
              <span className="input-wrap">
                <input
                  className="input has-reveal"
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={confirm.length > 0 && confirm !== password}
                />
              </span>
              {confirm.length > 0 && confirm !== password && <span className="hint warn">Doesn't match yet.</span>}
            </label>
            <label className="check">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              <span>I am 18 or older.</span>
            </label>
          </>
        )}

        {error && (
          <p className="alert" role="alert">
            <AlertCircle size={18} aria-hidden="true" /> {error}
          </p>
        )}
      </div>

      <div className="onboard-foot">
        <button type="button" className="btn primary block cta cta-xl" onClick={() => void next()} disabled={busy}>
          {busy ? "One moment…" : step === "Account" ? "Start hustling" : "Continue"}
          {!busy && <ArrowRight size={20} aria-hidden="true" />}
        </button>
        {step === "Look" && (
          <p className="guest-line">
            Not ready to open shop? <button type="button" onClick={onBrowse}>Browse merchants as guest</button>
          </p>
        )}
      </div>
    </div>
  );
}
