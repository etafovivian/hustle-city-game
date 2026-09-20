// Beta: errors in the player's browser are sent to the server on their own (so we see problems testers don't
// report), and "Report a problem" attaches where the player was, their device and the build.
declare const __BUILD__: string;
export const BUILD = typeof __BUILD__ === "string" ? __BUILD__ : "dev";

const recent: string[] = [];
const sent = new Set<string>();

/** Where the player is and what they're on, attached to every report. */
export function betaContext(extra: Record<string, unknown> = {}) {
  let pos: unknown = null;
  try {
    pos = JSON.parse(localStorage.getItem("hc_avatar_pos") ?? "null");
  } catch {}
  return {
    build: BUILD,
    path: location.pathname + location.search,
    screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
    agent: navigator.userAgent.slice(0, 200),
    online: navigator.onLine,
    mapPos: pos,
    recentErrors: recent.slice(-5),
    at: new Date().toISOString(),
    ...extra,
  };
}

function send(message: string, stack: string) {
  const key = message.slice(0, 200);
  recent.push(key);
  if (sent.has(key) || sent.size >= 10) return;
  sent.add(key);
  void fetch("/api/feedback/error", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: message.slice(0, 500), stack: stack.slice(0, 3000), context: betaContext() }),
  }).catch(() => undefined);
}

export function installErrorReporter() {
  window.addEventListener("error", (e) => {
    // Our own code only: not browser extensions, not the harmless "ResizeObserver loop" warning.
    if (e.filename && !e.filename.startsWith(location.origin)) return;
    if (/ResizeObserver loop/.test(e.message)) return;
    send(e.message || "Error", e.error instanceof Error ? (e.error.stack ?? "") : `${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    // API refusals (coins, rules) are handled in the UI; only real failures matter here.
    if (r && typeof r === "object" && "status" in r) return;
    send(r instanceof Error ? r.message : String(r).slice(0, 300), r instanceof Error ? (r.stack ?? "") : "");
  });
}
