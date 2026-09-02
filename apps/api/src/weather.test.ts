// Rain: umbrellas and getting soaked.
import { SOAKED, UMBRELLA, weatherAt } from "@hc/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareDatabase, registerPlayer, resetDatabase, testServer } from "./test/harness.js";

let app: Awaited<ReturnType<typeof testServer>>;
beforeAll(async () => {
  await prepareDatabase();
  app = await testServer();
});
afterAll(async () => {
  await app?.close();
});
beforeEach(async () => {
  await resetDatabase();
});
afterEach(() => {
  vi.useRealTimers();
});
const first = (w: string[]) => {
  for (let i = 0; i < 24 * 300; i++) {
    const t = new Date(Date.UTC(2026, 3, 1) + i * 3_600_000);
    if (w.includes(weatherAt(t))) return t;
  }
  throw new Error("no such weather");
};

describe("rain", () => {
  it("soaks you in the rain without an umbrella, at most once an hour; an umbrella keeps you dry", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(first(["rain", "storm"]));
    const p = await registerPlayer(app);
    const r = (await p.call("POST", "/api/game/soaked")).json();
    expect(r.soaked).toBe(true);
    expect(r.needs.style).toBeLessThanOrEqual(65 + SOAKED.style + 1);
    expect((await p.call("POST", "/api/game/soaked")).json().soaked).toBe(false); // cooldown
    const before = (await p.call("GET", "/api/me")).json().coins;
    expect((await p.call("POST", "/api/game/umbrella")).json().umbrella).toBe(true);
    expect((await p.call("GET", "/api/me")).json().coins).toBe(before - UMBRELLA.price);
    expect((await p.call("POST", "/api/game/umbrella")).statusCode).toBe(409);
    vi.setSystemTime(new Date(Date.now() + 2 * 3_600_000));
    expect((await p.call("GET", "/api/game/weather")).json()).toMatchObject({ umbrella: true });
  });

  it("does nothing in dry weather", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(first(["sunny"]));
    const p = await registerPlayer(app);
    expect((await p.call("POST", "/api/game/soaked")).json()).toEqual({ soaked: false });
  });
});
