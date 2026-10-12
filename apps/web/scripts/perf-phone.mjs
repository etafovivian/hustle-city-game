// Performance on a budget Android phone, measured in headless Chrome: a 360×780 screen, touch, and the CPU slowed
// down (6× by default, roughly a ₦100k Android against a laptop). Signs up a throwaway local account, opens the map,
// then measures it sitting still and while panning: frames per second, how busy the main thread is, JS memory and the
// number of page elements. Local only: run against `vite preview` (production build) and the local API.
//
//   node scripts/perf-phone.mjs [http://localhost:4190] [--cpu 6] [--chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The default look (as @hc/shared DEFAULT_AVATAR), inlined so the script runs on its own (e.g. in a container).
const DEFAULT_AVATAR = { skinTone: "#6b4226", hairStyle: "low_cut", outfit: "ankara_green" };

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const APP = args.find((a) => a.startsWith("http")) ?? "http://localhost:4190";
const API = opt("api", "http://127.0.0.1:4180");
const ORIGIN = opt("origin", "http://localhost:5190");
const CPU = Number(opt("cpu", "6"));
const CHROME = opt("chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. A throwaway local test account (local API only).
const nick = `perf_${Date.now().toString(36)}`;
const reg = await fetch(`${API}/api/auth/register`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: ORIGIN },
  body: JSON.stringify({
    email: `${nick}@example.test`,
    password: `perf-${Math.random().toString(36).slice(2)}-pass`,
    nickname: nick,
    avatar: DEFAULT_AVATAR,
    hustle: "artisan",
    confirmAdult: true,
  }),
});
if (reg.status !== 201) throw new Error(`register failed: ${reg.status} ${await reg.text()}`);
const [cookieName, cookieValue] = reg.headers.get("set-cookie").split(";")[0].split("=");

// 2. Headless Chrome with the DevTools protocol.
const profile = mkdtempSync(join(tmpdir(), "hc-perf-"));
// In a container (the lab perf runner) Chrome has no sandbox to use: PERF_NO_SANDBOX=1.
const sandbox = process.env.PERF_NO_SANDBOX ? ["--no-sandbox", "--disable-dev-shm-usage"] : [];
const chrome = spawn(CHROME, ["--headless=new", ...sandbox, `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--window-size=360,780", "about:blank"], { stdio: "ignore" });
let pageWs;
for (let i = 0; i < 50 && !pageWs; i++) {
  await sleep(200);
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    pageWs = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {}
}
if (!pageWs) throw new Error("Chrome didn't start");
const ws = new WebSocket(pageWs);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
const metrics = async () => Object.fromEntries((await send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));

await send("Network.enable");
await send("Performance.enable");
await send("Network.setCookie", { name: cookieName, value: cookieValue, url: APP });
await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 780, deviceScaleFactor: 2, mobile: true });
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Emulation.setCPUThrottlingRate", { rate: CPU });

// 3. Load the map and let it settle.
const t0 = Date.now();
await send("Page.enable");
await send("Page.navigate", { url: APP });
let mapAt = 0;
for (let i = 0; i < 120 && !mapAt; i++) {
  await sleep(500);
  if (await evaluate("!!document.querySelector('.map-viewport svg image')")) mapAt = Date.now() - t0;
}
await sleep(8000);

/** Frames, main-thread busy share and long tasks over `ms`, optionally while doing something. */
const window_ = async (ms, during) => {
  const before = await metrics();
  const measure = evaluate(`new Promise((done) => {
    let frames = 0, worst = 0, last = performance.now(), long = 0;
    const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) long += e.duration; });
    po.observe({ type: "longtask" });
    const end = performance.now() + ${ms};
    const f = (t) => { frames++; worst = Math.max(worst, t - last); last = t; if (t < end) requestAnimationFrame(f); else { po.disconnect(); done({ fps: +(frames / (${ms} / 1000)).toFixed(1), worstFrameMs: Math.round(worst), longTaskMsPerSec: Math.round(long / (${ms} / 1000)) }); } };
    requestAnimationFrame(f);
  })`);
  if (during) await during();
  const r = await measure;
  const after = await metrics();
  return { ...r, mainThreadBusy: `${Math.round(((after.TaskDuration - before.TaskDuration) / (ms / 1000)) * 100)}%`, scriptMsPerSec: Math.round(((after.ScriptDuration - before.ScriptDuration) * 1000) / (ms / 1000)) };
};

// --profile: where the main thread's time goes while the map sits still (self time per function).
if (args.includes("--profile")) {
  await send("Profiler.enable");
  await send("Profiler.setSamplingInterval", { interval: 500 });
  await send("Profiler.start");
  await sleep(6000);
  const { profile: prof } = await send("Profiler.stop");
  const dt = (prof.endTime - prof.startTime) / prof.samples.length / 1000;
  const counts = new Map();
  for (const s of prof.samples) counts.set(s, (counts.get(s) ?? 0) + 1);
  const self = new Map();
  for (const n of prof.nodes) {
    const c = counts.get(n.id) ?? 0;
    if (!c) continue;
    const f = n.callFrame;
    const key = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + c * dt);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log("Top self time over 6 s (ms):");
  for (const [k, v] of top) console.log(`${String(Math.round(v)).padStart(6)}  ${k}`);
}
// --shots <dir>: pictures before a drag, mid-drag (finger still down) and after letting go, to check the map
// doesn't tear or jump when the picture slides and then re-draws.
const shotsAt = args.includes("--shots") ? opt("shots", ".") : null;
if (shotsAt) {
  const { writeFileSync } = await import("node:fs");
  const shot = async (name) => writeFileSync(join(shotsAt, `${name}.png`), Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await shot("pan-0-before");
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 300, y: 500 }] });
  for (let s = 1; s <= 10; s++) {
    await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 300 - s * 18, y: 500 - s * 12 }] });
    await sleep(30);
  }
  await shot("pan-1-mid-drag");
  await sleep(400);
  await shot("pan-2-paused");
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(1200);
  await shot("pan-3-after");
}
const idle = await window_(8000);
// Pan: drag across the map, back and forth (one finger).
const pan = await window_(8000, async () => {
  for (let k = 0; k < 6; k++) {
    const [x0, x1] = k % 2 ? [80, 280] : [280, 80];
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: 420 }] });
    for (let s = 1; s <= 12; s++) {
      await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * s) / 12, y: 420 + s * 6 }] });
      await sleep(40);
    }
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(150);
  }
});
const m = await metrics();
const page = await evaluate(`({ elements: document.querySelectorAll('*').length, svgImages: document.querySelectorAll('svg image').length, vehicles: document.querySelectorAll('.traffic > g').length, smilAnimations: document.querySelectorAll('animate, animateTransform, animateMotion').length, cssAnimations: document.getAnimations().length, cssAnimationNames: [...new Set(document.getAnimations().map((a) => a.animationName || a.constructor.name))].slice(0, 20) })`);
const net = await evaluate(`(() => { const r = performance.getEntriesByType('resource'); const kb = (f) => Math.round(r.filter(f).reduce((a, x) => a + (x.transferSize || x.encodedBodySize || 0), 0) / 1024); return { requests: r.length, jsKB: kb((x) => /\\.js/.test(x.name)), artKB: kb((x) => /\\.(webp|png|svg)/.test(x.name)) }; })()`);

console.log(
  JSON.stringify(
    { cpuSlowdown: `${CPU}x`, screen: "360x780 @2x", mapVisibleAfterMs: mapAt, jsHeapMB: Math.round(m.JSHeapUsedSize / 1e6), domNodes: m.Nodes, ...page, ...net, idle, panning: pan },
    null,
    2,
  ),
);
ws.close();
chrome.kill();
await sleep(300);
try {
  rmSync(profile, { recursive: true, force: true });
} catch {}
