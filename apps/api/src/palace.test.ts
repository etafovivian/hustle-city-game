// The Oba's palace: the chieftaincy title (the flex) is given once, kept, and shown to others on presence.
import postgres from "postgres";
import { CHIEF_TITLE } from "@hc/shared";
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T11:00:00Z")); // noon in Lagos: the palace is open
});
afterEach(() => {
  vi.useRealTimers();
});
const rich = async (p: Player) => {
  const s = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await s`update profiles set coin_balance = ${2_000_000} where user_id = ${p.id}`;
  await s.end();
};

describe("palace", () => {
  it("makes you a chief once, and others see the title", async () => {
    const chief = await registerPlayer(app);
    const friend = await registerPlayer(app);
    await rich(chief);
    expect((await chief.call("GET", "/api/game/title")).json().title).toBeNull();
    expect((await chief.call("POST", "/api/game/venues/oba_palace/homage")).statusCode).toBe(200);
    const flex = (await chief.call("POST", "/api/game/venues/oba_palace/flex")).json();
    expect(flex.title).toBe(CHIEF_TITLE.label);
    expect((await chief.call("GET", "/api/game/title")).json().title).toBe(CHIEF_TITLE.label);
    // Not twice (not even another day)
    vi.setSystemTime(new Date("2026-10-15T11:00:00Z"));
    expect((await chief.call("POST", "/api/game/venues/oba_palace/flex")).statusCode).toBe(409);
    await chief.call("POST", "/api/presence", { x: 3900, y: 4200, place: "oba_palace" });
    const seen = (await friend.call("POST", "/api/presence", { x: 3910, y: 4210, place: null })).json();
    expect(seen.players.find((p: { title?: string }) => p.title)?.title).toBe(CHIEF_TITLE.label);
  });
});
