// Skills grow with play and pay off; renting a flat and letting a house.
import postgres from "postgres";
import { AREA_BOYS_OPTIONS, RENT_TERMS, SKILL_POINTS, WEEK_MS, letRent, moveInCost, plotPriceOf, PLOTS_FOR_SALE } from "@hc/shared";
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
async function sql<T>(fn: (s: postgres.Sql) => Promise<T>) {
  const s = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    return await fn(s);
  } finally {
    await s.end();
  }
}
const coins = async (p: Player) => (await p.call("GET", "/api/me")).json().coins as number;

describe("skills", () => {
  it("grow from shifts at matching jobs and raise the pay", async () => {
    const p = await registerPlayer(app);
    expect((await p.call("GET", "/api/game/skills")).json().cooking).toEqual({ points: 0, level: 0 });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T11:00:00Z")); // noon in Lagos: the buka is open
    const first = (await p.call("POST", "/api/game/jobs/mama_nkechi_buka/shift")).json();
    expect((await p.call("GET", "/api/game/skills")).json().cooking.points).toBe(SKILL_POINTS.shift);
    // Level 3 cooking: +12% pay for the same rung.
    await sql((s) => s`update player_skills set points = 360 where user_id = ${p.id} and skill = 'cooking'`);
    await sql((s) => s`update player_jobs set shifts = 0 where user_id = ${p.id}`);
    const second = (await p.call("POST", "/api/game/jobs/mama_nkechi_buka/shift")).json();
    expect(second.pay).toBe(Math.round(first.pay * 1.12));
  });

  it("charisma makes talking your way out likelier", async () => {
    const { dice } = await import("./modules/game/rides.js");
    const p = await registerPlayer(app);
    const talk = AREA_BOYS_OPTIONS.find((o) => o.choice === "talk")!;
    await sql((s) => s`insert into player_skills (user_id, skill, points) values (${p.id}, 'charisma', 4000)`);
    const ride = async () => {
      dice.roll = () => 0; // the stop happens
      const r = (await p.call("POST", "/api/game/rides", { mode: "okada", units: 2000 })).json();
      dice.roll = () => talk.odds + 0.2; // would fail without skill, passes with +30%
      return (await p.call("POST", `/api/game/rides/${r.rideId}/stop`, { choice: "talk" })).json();
    };
    await sql((s) => s`update profiles set coin_balance = 100000 where user_id = ${p.id}`);
    expect((await ride()).ok).toBe(true);
    dice.roll = () => Math.random();
  });
});

describe("rent", () => {
  it("moves into a flat, pays weekly, and evicts two weeks behind", async () => {
    const p = await registerPlayer(app);
    await sql((s) => s`update profiles set coin_balance = 100000 where user_id = ${p.id}`);
    const cost = moveInCost("rent_mini_flat", "Island Heights");
    const r = (await p.call("POST", "/api/game/rent", { unit: "rent_mini_flat", area: "Island Heights", plotId: "island-heights-land-3" })).json();
    expect(r.cost.total).toBe(cost.total);
    expect(r.home).toMatchObject({ design: "rent_mini_flat", rental: { area: "Island Heights", weekly: cost.weekly, owing: 0 } });
    expect(await coins(p)).toBe(100000 - cost.total);
    // Half a week overdue: one week is paid from coins.
    await sql((s) => s`update rentals set paid_until = now() - interval '3 days' where user_id = ${p.id}`);
    expect((await p.call("GET", "/api/game/home")).json().rental.owing).toBe(0);
    expect(await coins(p)).toBe(100000 - cost.total - cost.weekly);
    // Broke and over two weeks behind: evicted.
    await sql((s) => s`update profiles set coin_balance = 0 where user_id = ${p.id}`);
    await sql((s) => s`update rentals set paid_until = now() - interval '15 days' where user_id = ${p.id}`);
    expect((await p.call("GET", "/api/game/home")).json()).toMatchObject({ rental: null, design: null });
  });

  it("refunds the caution on moving out", async () => {
    const p = await registerPlayer(app);
    await sql((s) => s`update profiles set coin_balance = 100000 where user_id = ${p.id}`);
    const cost = moveInCost("rent_self_contain", "Ikodu Town");
    await p.call("POST", "/api/game/rent", { unit: "rent_self_contain", area: "Ikodu Town", plotId: "ikodu-town-land-1" });
    expect((await p.call("POST", "/api/game/rent", { unit: "rent_flat", area: "Ikodu Town", plotId: "x-land-1" })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/rent/leave")).json()).toMatchObject({ refund: cost.caution, home: { rental: null } });
    expect(await coins(p)).toBe(100000 - cost.total + cost.caution);
  });

  it("lets a house that isn't home and collects the rent", async () => {
    const p = await registerPlayer(app);
    await sql((s) => s`update profiles set coin_balance = 5000000 where user_id = ${p.id}`);
    const [a, b] = PLOTS_FOR_SALE.slice(0, 2).map((x) => x[0]);
    await p.call("POST", `/api/land/${encodeURIComponent(a!)}/buy`, { design: "bungalow" });
    await p.call("POST", `/api/land/${encodeURIComponent(b!)}/buy`, { design: "villa" });
    expect((await p.call("POST", `/api/plots/${encodeURIComponent(a!)}/let`, { on: true })).statusCode).toBe(409); // your home
    expect((await p.call("POST", `/api/plots/${encodeURIComponent(b!)}/let`, { on: true })).statusCode).toBe(200);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 2 * WEEK_MS));
    const before = await coins(p);
    const weekly = letRent("villa", b!);
    expect(weekly).toBe(Math.round((260_000 * 0.03 + (plotPriceOf(b!) ?? 0) * 0.01) / 50) * 50);
    const c = (await p.call("POST", `/api/plots/${encodeURIComponent(b!)}/collect`)).json();
    expect(c.collected).toBe(weekly * 2);
    expect(await coins(p)).toBe(before + weekly * 2);
  });
});
