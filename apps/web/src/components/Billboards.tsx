// Billboards: banner ads from real businesses on boards around the map.
// Boards on the map (rotating banners), the board sheet (ads + "Add your ad"), booking with an in-browser
// crop to 1200×400, the advertiser's report in the Phone, and the admin review/payment queue.
import {
  AD_BANNER,
  AD_MAX_WEEKS,
  AD_POLICY,
  AD_STATUS_LABEL,
  adDomain,
  type BillboardView,
  type BoardAd,
  type MyAd,
} from "@hc/shared";
import { AlertCircle, CheckCircle2, ExternalLink, ImagePlus, Megaphone, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, formatNaira } from "../api.js";

const fmtDay = (iso: string) => new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

/** Count the click, then open the advertiser's link in a new tab (never with access to this page). */
export function openAd(ad: BoardAd) {
  void api("POST", `/api/billboards/ads/${ad.id}/click`).catch(() => undefined);
  window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
}

/** A board on the map: two posts and a lit panel showing the current banner, or a "your ad here" card. */
export function BillboardOnMap({ board, x, y, tick, onOpen }: { board: BillboardView; x: number; y: number; tick: number; onOpen: () => void }) {
  const mega = board.tier === "mega";
  const w = mega ? 360 : 300;
  const h = w / 3;
  const post = mega ? 170 : 150;
  const ad = board.ads.length ? board.ads[tick % board.ads.length] : undefined;
  return (
    <g
      className="hotspot billboard"
      role="button"
      tabIndex={0}
      aria-label={`${board.name} billboard${ad ? `: ${ad.headline}` : ": space available"}. Open the board.`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
    >
      <ellipse cx={x} cy={y} rx={w * 0.38} ry="12" fill="rgb(0 0 0 / 25%)" />
      {/* Whole board is tappable, including the gap between the posts. */}
      <rect x={x - w / 2 - 8} y={y - post - h - 8} width={w + 16} height={post + h + 8} fill="transparent" />
      <rect x={x - w * 0.32} y={y - post} width="10" height={post} fill="#4b4f57" stroke="#1d1f24" strokeWidth="2" />
      <rect x={x + w * 0.32 - 10} y={y - post} width="10" height={post} fill="#4b4f57" stroke="#1d1f24" strokeWidth="2" />
      <rect x={x - w / 2 - 8} y={y - post - h - 8} width={w + 16} height={h + 16} rx="6" fill="#1d1f24" stroke={mega ? "#ffc72c" : "#6b7280"} strokeWidth="4" />
      {ad ? (
        <image href={ad.imageUrl} x={x - w / 2} y={y - post - h} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <g>
          <rect x={x - w / 2} y={y - post - h} width={w} height={h} fill="#ffc72c" />
          <text x={x} y={y - post - h / 2 - 4} textAnchor="middle" fontSize={mega ? 30 : 26} fontWeight="900" fill="#0a0f24">
            YOUR AD HERE
          </text>
          <text x={x} y={y - post - h / 2 + 24} textAnchor="middle" fontSize={mega ? 18 : 16} fontWeight="700" fill="#0a0f24">
            from {formatNaira(board.priceKoboPerWeek)}/week
          </text>
        </g>
      )}
      <g transform={`translate(${x + w / 2 - 34} ${y - post - h + 6})`}>
        <rect width="28" height="16" rx="3" fill="rgb(10 15 36 / 85%)" />
        <text x="14" y="12" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">
          AD
        </text>
      </g>
      {mega && (
        <text x={x - w / 2 + 4} y={y - post - h - 14} fontSize="16" fontWeight="900" fill="#ffc72c" stroke="#0a0f24" strokeWidth="4" paintOrder="stroke">
          MEGA
        </text>
      )}
    </g>
  );
}

/** Crop and resize any picture to the banner size in the browser, as WebP (JPEG where WebP can't be encoded). */
async function toBanner(file: File): Promise<{ base64: string; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = AD_BANNER.width;
  canvas.height = AD_BANNER.height;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  const encode = (type: string, q: number) => new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read that image."))), type, q));
  let blob = await encode("image/webp", 0.86);
  if (blob.type !== "image/webp") blob = await encode("image/jpeg", 0.85);
  for (let q = 0.75; blob.size > AD_BANNER.maxBytes && q > 0.4; q -= 0.1) blob = await encode(blob.type, q);
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { base64: btoa(bin), preview: URL.createObjectURL(blob) };
}

function BookAd({ board, onDone }: { board: BillboardView; onDone: () => void }) {
  const [banner, setBanner] = useState<{ base64: string; preview: string } | null>(null);
  const [headline, setHeadline] = useState("");
  const [link, setLink] = useState("https://");
  const [weeks, setWeeks] = useState(1);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      setBanner(await toBanner(file));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!banner) return setError("Add a banner picture.");
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/api/billboards/ads", { billboardKey: board.key, headline, linkUrl: link, weeks, image: banner.base64, agreePolicy: agree });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="stack req-form">
        <p className="notice">
          <CheckCircle2 size={18} aria-hidden="true" /> Booked. We check every ad first, then send bank transfer details for {formatNaira(board.priceKoboPerWeek * weeks)} to your email. It goes on air when payment arrives.
        </p>
        <p className="small muted">Track it in Phone → Ads.</p>
        <button type="button" className="btn" onClick={onDone}>
          Done
        </button>
      </div>
    );

  return (
    <form className="stack req-form" onSubmit={(e) => void submit(e)}>
      <strong>Put your ad on {board.name}</strong>
      <label className="banner-drop">
        {banner ? <img src={banner.preview} alt="Your banner preview" /> : <span className="small"><ImagePlus size={20} aria-hidden="true" /> Choose a picture. We crop it to the board's shape (3:1).</span>}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void pick(e.target.files?.[0])} className="sr-only" />
      </label>
      <label className="field">
        <span className="field-label">Headline</span>
        <input className="input" maxLength={80} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Fresh suya every night in Yaba" required />
      </label>
      <label className="field">
        <span className="field-label">Link (website, WhatsApp or social page)</span>
        <input className="input" type="url" maxLength={300} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://wa.me/234…" required />
      </label>
      <label className="field">
        <span className="field-label">How long</span>
        <select className="input" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
          {Array.from({ length: AD_MAX_WEEKS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} week{n > 1 ? "s" : ""} · {formatNaira(board.priceKoboPerWeek * n)}
            </option>
          ))}
        </select>
      </label>
      <details className="small">
        <summary>Ad rules</summary>
        <ul>
          {AD_POLICY.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </details>
      <label className="check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>My ad follows the ad rules, and I own or may use the picture.</span>
      </label>
      {error && (
        <p className="alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      )}
      <button className="btn primary block" type="submit" disabled={busy || !agree}>
        {busy ? "Sending…" : `Book for ${formatNaira(board.priceKoboPerWeek * weeks)}`}
      </button>
      <p className="tiny muted">No payment now. We review the ad, then send payment details. In-app payment comes later.</p>
    </form>
  );
}

/** A board's sheet: everything on air there, and booking. `board` null shows the list of all boards. */
export function BillboardSheet({ boards, boardKey, signedIn, onPick, onClose }: { boards: BillboardView[]; boardKey: string | null; signedIn: boolean; onPick: (key: string | null) => void; onClose: () => void }) {
  const [booking, setBooking] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const board = boards.find((b) => b.key === boardKey) ?? null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    setBooking(false);
  }, [boardKey]);

  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet" role="dialog" aria-modal="true" aria-label={board ? `${board.name} billboard` : "Billboards"} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        {!board ? (
          <>
            <div className="visit-head">
              <span className="tiny dream-kicker">
                <Megaphone size={14} aria-hidden="true" /> Billboards
              </span>
              <h2>Advertise your business</h2>
              <span className="small muted">Your banner takes turns with the other ads on a board, {AD_BANNER.width}×{AD_BANNER.height}, 15 seconds each. Players tap through to your link.</span>
            </div>
            <ul className="req-list">
              {boards.map((b) => (
                <li key={b.key}>
                  <button type="button" className="req-row" onClick={() => onPick(b.key)}>
                    <span className="req-row-main">
                      <strong>
                        {b.name} {b.tier === "mega" && <span className="tag mega">MEGA</span>}
                      </strong>
                      <span className="tiny muted">
                        {b.ads.length} on air · {b.capacity - b.taken > 0 ? `${b.capacity - b.taken} places free` : "full"} · {formatNaira(b.priceKoboPerWeek)}/week
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="visit-head">
              <button type="button" className="link-btn small" onClick={() => onPick(null)}>
                All billboards
              </button>
              <h2>
                {board.name} {board.tier === "mega" && <span className="tag mega">MEGA</span>}
              </h2>
              <span className="small muted">
                {board.ads.length === 0 ? "No ads on air yet" : board.ads.length === 1 ? "1 ad on air" : `${board.ads.length} ads take turns, 15 s each`} · {formatNaira(board.priceKoboPerWeek)} per week
              </span>
            </div>
            <div className="board-ads">
              {board.ads.map((ad) => (
                <figure key={ad.id} className="board-ad">
                  <img src={ad.imageUrl} alt={ad.headline} loading="lazy" />
                  <figcaption className="spread">
                    <button type="button" className="btn sm go" onClick={() => openAd(ad)}>
                      <ExternalLink size={15} aria-hidden="true" /> Visit {adDomain(ad.linkUrl)}
                    </button>
                    <span className="tiny muted">until {fmtDay(ad.until)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            {booking ? (
              <BookAd board={board} onDone={() => setBooking(false)} />
            ) : board.taken >= board.capacity ? (
              <p className="small muted">This board is full right now. Try another board.</p>
            ) : signedIn ? (
              <button type="button" className="btn primary" onClick={() => setBooking(true)}>
                <Megaphone size={16} aria-hidden="true" /> Add your ad to this board
              </button>
            ) : (
              <p className="small muted">Sign in to book an ad.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Phone → Ads: the advertiser's bookings, status and results. */
export function MyAds() {
  const [ads, setAds] = useState<MyAd[] | null>(null);
  useEffect(() => {
    api<MyAd[]>("GET", "/api/billboards/ads/mine")
      .then(setAds)
      .catch(() => setAds([]));
  }, []);
  if (!ads) return <p className="muted small">Loading…</p>;
  return (
    <div className="stack account-form">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>Your ads</h2>
        <p className="small muted">Book a billboard from the map: tap any board, or the megaphone button.</p>
      </div>
      {!ads.length && <p className="small muted">No ads yet.</p>}
      {ads.map((a) => (
        <div key={a.id} className="quote-card">
          <img className="my-ad-img" src={a.imageUrl} alt={a.headline} />
          <strong>{a.headline}</strong>
          <span className="tiny muted">
            {a.billboardName} · {a.weeks} week{a.weeks > 1 ? "s" : ""} · {formatNaira(a.priceKobo)}
          </span>
          <span className={`req-status ad-${a.status}`} style={{ justifySelf: "start" }}>
            {AD_STATUS_LABEL[a.status]}
          </span>
          {a.reviewNote && <span className="small muted">Moderator note: {a.reviewNote}</span>}
          {a.status === "awaiting_payment" && <span className="small">Approved. Our team will email you bank transfer details. It goes on air when payment arrives.</span>}
          {(a.status === "live" || a.status === "ended") && (
            <span className="small">
              {a.views.toLocaleString("en-NG")} views · {a.clicks.toLocaleString("en-NG")} clicks{a.endsAt ? ` · until ${fmtDay(a.endsAt)}` : ""}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

interface AdminAd {
  id: string;
  billboardName: string;
  headline: string;
  linkUrl: string;
  imageUrl: string;
  weeks: number;
  priceKobo: number;
  status: MyAd["status"];
}

const REJECT = [
  { key: "gambling_or_schemes", label: "Gambling or money schemes" },
  { key: "misleading", label: "Misleading or someone else's brand" },
  { key: "adult_or_illegal", label: "Adult or illegal" },
  { key: "political", label: "Political or religious campaigning" },
  { key: "poor_quality", label: "Poor quality banner" },
  { key: "other", label: "Other" },
];

/** Admin → ads: review content, then record the bank transfer to put it on air. */
export function AdminAds({ notify }: { notify: (m: string) => void }) {
  const [ads, setAds] = useState<AdminAd[] | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [ref, setRef] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    api<AdminAd[]>("GET", "/api/admin/billboards/ads")
      .then(setAds)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  const call = async (path: string, body: unknown, ok: string) => {
    setError(null);
    try {
      await api("POST", path, body);
      notify(ok);
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const open = ads?.filter((a) => a.status === "in_review" || a.status === "awaiting_payment") ?? [];
  return (
    <div className="stack account-form">
      <h2 style={{ fontSize: 20 }}>Ad review</h2>
      {ads && !open.length && <p className="small muted">No ads waiting.</p>}
      {open.map((a) => (
        <div key={a.id} className="quote-card">
          <img className="my-ad-img" src={a.imageUrl} alt={a.headline} />
          <strong>{a.headline}</strong>
          <span className="tiny muted">
            {a.billboardName} · {a.weeks} wk · {formatNaira(a.priceKobo)} · {adDomain(a.linkUrl)}
          </span>
          <span className={`req-status ad-${a.status}`} style={{ justifySelf: "start" }}>
            {AD_STATUS_LABEL[a.status]}
          </span>
          {a.status === "in_review" ? (
            <>
              <select className="input" aria-label="Reason if rejecting" value={reason[a.id] ?? "gambling_or_schemes"} onChange={(e) => setReason((r) => ({ ...r, [a.id]: e.target.value }))}>
                {REJECT.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <div className="row">
                <button type="button" className="btn primary" onClick={() => void call(`/api/admin/billboards/ads/${a.id}/review`, { decision: "approve", reasonCode: "meets_policy" }, "Approved")}>
                  Approve
                </button>
                <button type="button" className="btn quiet" onClick={() => void call(`/api/admin/billboards/ads/${a.id}/review`, { decision: "reject", reasonCode: reason[a.id] ?? "gambling_or_schemes" }, "Rejected")}>
                  Reject
                </button>
              </div>
            </>
          ) : (
            <div className="req-note">
              <input className="input" placeholder="Bank transfer reference" value={ref[a.id] ?? ""} onChange={(e) => setRef((r) => ({ ...r, [a.id]: e.target.value }))} />
              <button type="button" className="btn sm primary" onClick={() => void call(`/api/admin/billboards/ads/${a.id}/payment`, { reference: ref[a.id] ?? "" }, "Payment recorded. Ad is on air.")}>
                Paid
              </button>
            </div>
          )}
        </div>
      ))}
      {error && (
        <p className="alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}
