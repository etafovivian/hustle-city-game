// Abuja: a flight away. Players can stand there (presence), buy land in its districts, and use its places.
import postgres from "postgres";
import { PLOTS_FOR_SALE, landPrice } from "@hc/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer, type Player } from "./test/harness.js";

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
const rich = async (p: Player, coins = 5_000_000) => {
  const s = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await s`update profiles set coin_balance = ${coins} where user_id = ${p.id}`;
  await s.end();
};
const enc = encodeURIComponent;

describe("abuja", () => {
  it("accepts presence there, far east of Lagos", async () => {
    const p = await registerPlayer(app);
    expect((await p.call("POST", "/api/presence", { x: 22_000, y: -1800, place: "zone5_market" })).statusCode).toBe(200);
  });

  it("sells Maitama land dear and Kubwa land cheap", async () => {
    const p = await registerPlayer(app);
    await rich(p);
    const maitama = PLOTS_FOR_SALE.find((r) => r[1] === "Maitama")!;
    const kubwa = PLOTS_FOR_SALE.find((r) => r[1] === "Kubwa")!;
    const a = (await p.call("POST", `/api/land/${enc(maitama[0])}/buy`, {})).json();
    const b = (await p.call("POST", `/api/land/${enc(kubwa[0])}/buy`, {})).json();
    expect(a.paid).toBe(landPrice("Maitama", maitama[2], maitama[3]));
    expect(b.paid).toBe(landPrice("Kubwa", kubwa[2], kubwa[3]));
    expect(a.paid).toBeGreaterThan(b.paid * 5);
  });

  it("runs its places like any other: the market and the polo club", async () => {
    const p = await registerPlayer(app);
    await rich(p);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T11:00:00Z")); // noon in Lagos time
    for (const [venue, activity] of [
      ["zone5_market", "browse"],
      ["capital_polo_club", "polo"],
      ["abuja_secretariat", "file"],
    ] as const) {
      const r = await p.call("POST", `/api/game/venues/${venue}/${activity}`);
      expect(r.statusCode, venue).toBe(200);
    }
    expect((await p.call("POST", "/api/game/jobs/abuja_secretariat/shift")).statusCode).toBe(200);
  });
});
