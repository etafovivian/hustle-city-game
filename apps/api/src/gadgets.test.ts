// Gadget Village: buy phones and accessories (tag price or haggled), crack a screen running from the area boys, fix it.
// Also the new landmarks' activities (Crown Arts Theatre, Independence Square, Liberty Arts Park) through the venue route.
import postgres from "postgres";
import { CRACKED, GADGET_BY_KEY, GADGET_HAGGLE_TRIES, REPAIR_PRICE, dayKey, gadgetFloor, PARTS_SHARE } from "@hc/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { dice } from "./modules/game/rides.js";
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOON);
});
afterEach(() => {
  vi.useRealTimers();
});
/** Noon in Lagos on a Wednesday: the shops are open. */
const NOON = new Date("2026-10-14T11:00:00Z");
async function sql<T>(fn: (s: postgres.Sql) => Promise<T>) {
  const s = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    return await fn(s);
  } finally {
    await s.end();
  }
}
const rich = (p: Player, coins = 500_000) => sql((s) => s`update profiles set coin_balance = ${coins} where user_id = ${p.id}`);
const coins = async (p: Player) => (await p.call("GET", "/api/me")).json().coins as number;

describe("gadget village", () => {
  it("sells a better phone at the tag price, once, and never a worse one", async () => {
    const p = await registerPlayer(app);
    await rich(p);
    const before = await coins(p);
    const bought = await p.call("POST", "/api/game/gadgets/buy", { key: "phone_flagship" });
    expect(bought.statusCode).toBe(200);
    expect(bought.json().view).toMatchObject({ phone: 2, owned: ["phone_flagship"], cracked: false });
    expect(await coins(p)).toBe(before - GADGET_BY_KEY.get("phone_flagship")!.price);
    expect((await p.call("POST", "/api/game/gadgets/buy", { key: "phone_flagship" })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/gadgets/buy", { key: "phone_mid" })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/gadgets/buy", { key: "earbuds" })).statusCode).toBe(200);
    expect((await p.call("GET", "/api/game/gadgets")).json().owned.sort()).toEqual(["earbuds", "phone_flagship"]);
  });

  it("is shut at night and refuses what it doesn't sell", async () => {
    const p = await registerPlayer(app);
    await rich(p);
    vi.setSystemTime(new Date("2026-10-14T21:00:00Z")); // 10 pm in Lagos
    expect((await p.call("POST", "/api/game/gadgets/buy", { key: "phone_mid" })).statusCode).toBe(409);
    vi.setSystemTime(NOON);
    expect((await p.call("POST", "/api/game/gadgets/buy", { key: "rolex" })).statusCode).toBe(404);
  });

  it("haggles: too low walks off, close gets a counter, the floor is a deal, and tries run out", async () => {
    const p = await registerPlayer(app);
    await rich(p);
    const floor = gadgetFloor(p.id, dayKey(NOON, "Africa/Lagos"), "phone_mid")!;
    const price = GADGET_BY_KEY.get("phone_mid")!.price;
    expect(floor).toBeLessThan(price);
    expect((await p.call("POST", "/api/game/gadgets/haggle", { key: "phone_mid", offer: Math.floor(floor * 0.5) })).json()).toMatchObject({ result: "walked", triesLeft: GADGET_HAGGLE_TRIES - 1 });
    const counter = (await p.call("POST", "/api/game/gadgets/haggle", { key: "phone_mid", offer: floor - 1 })).json();
    expect(counter.result).toBe("counter");
    expect(counter.counter).toBeGreaterThanOrEqual(floor);
    const before = await coins(p);
    const deal = (await p.call("POST", "/api/game/gadgets/haggle", { key: "phone_mid", offer: floor })).json();
    expect(deal).toMatchObject({ result: "deal", paid: floor, saved: price - floor });
    expect(await coins(p)).toBe(before - floor);
    // Out of tries on another item
    for (let i = 0; i < GADGET_HAGGLE_TRIES; i++) await p.call("POST", "/api/game/gadgets/haggle", { key: "power_bank", offer: 1 });
    expect((await p.call("POST", "/api/game/gadgets/haggle", { key: "power_bank", offer: 1 })).statusCode).toBe(409);
  });

  it("cracks the screen when the area boys catch you, a case saves it, and Tech lets you fix it for the parts", async () => {
    const p = await registerPlayer(app);
    await rich(p);
    const caught = async () => {
      dice.roll = () => 0; // stopped
      const ride = (await p.call("POST", "/api/game/rides", { mode: "okada", units: 3000 })).json();
      dice.roll = () => 0.999; // and running fails
      return (await p.call("POST", `/api/game/rides/${ride.rideId}/stop`, { choice: "run" })).json();
    };
    const first = await caught();
    expect(first).toMatchObject({ ok: false, cracked: true });
    expect((await p.call("GET", "/api/game/gadgets")).json()).toMatchObject({ cracked: true, repairPrice: REPAIR_PRICE[0] });
    const before = await coins(p);
    const fixed = (await p.call("POST", "/api/game/gadgets/repair", { requestId: crypto.randomUUID() })).json();
    expect(fixed).toMatchObject({ paid: REPAIR_PRICE[0], self: false, view: { cracked: false } });
    expect(await coins(p)).toBe(before - REPAIR_PRICE[0]);
    expect((await p.call("POST", "/api/game/gadgets/repair", { requestId: crypto.randomUUID() })).statusCode).toBe(409);

    // Tech level 3: fix it yourself, parts only
    await caught();
    await sql((s) => s`insert into player_skills (user_id, skill, points) values (${p.id}, 'tech', 400)`);
    const self = (await p.call("POST", "/api/game/gadgets/repair", { requestId: crypto.randomUUID() })).json();
    expect(self).toMatchObject({ self: true, paid: Math.round((REPAIR_PRICE[0] * PARTS_SHARE) / 50) * 50 });

    // A case: caught again, the screen survives
    expect((await p.call("POST", "/api/game/gadgets/buy", { key: "phone_case" })).statusCode).toBe(200);
    const safe = await caught();
    expect(safe.ok).toBe(false);
    expect(safe.cracked).toBeUndefined();
    const rows = await sql((s) => s`select item from player_items where user_id = ${p.id} and item = ${CRACKED}`);
    expect(rows.length).toBe(0);
  });

  it("the phone-repair apprentice shift trains Tech", async () => {
    const p = await registerPlayer(app);
    const shift = await p.call("POST", "/api/game/jobs/gadget_village/shift");
    expect(shift.statusCode).toBe(200);
    expect((await p.call("GET", "/api/game/skills")).json().tech.points).toBeGreaterThan(0);
  });
});

describe("landmarks", () => {
  it("sells theatre, square and park tickets like any venue: coins, XP and Fun", async () => {
    const p = await registerPlayer(app);
    await rich(p);
    vi.setSystemTime(new Date("2026-10-14T13:00:00Z")); // 2 pm in Lagos: all three are open
    for (const [venue, activity] of [
      ["crown_arts_theatre", "play"],
      ["independence_square", "concert"],
      ["liberty_arts_park", "open_mic"],
    ] as const) {
      const r = await p.call("POST", `/api/game/venues/${venue}/${activity}`);
      expect(r.statusCode, venue).toBe(200);
      expect(r.json().gained).toBeGreaterThan(0);
      expect(r.json().needs.fun).toBeGreaterThan(0);
    }
  });

  it("the Independence Day parade makes the square count for more on 1 October", async () => {
    const p = await registerPlayer(app);
    await rich(p);
    vi.setSystemTime(new Date("2026-10-01T09:00:00Z")); // 10 am in Lagos on 1 October
    const r = (await p.call("POST", "/api/game/venues/independence_square/parade")).json();
    expect(r.event).toBe("Independence Day parade");
  });
});
