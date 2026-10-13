// Holy books: reading brings a calm mind once a Lagos day; any of the three books; nothing else.
import { READ_GIVES } from "@hc/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

describe("holy books", () => {
  it("bring a calm mind once a day", async () => {
    const p = await registerPlayer(app);
    const e0 = (await p.call("GET", "/api/game/needs")).json().needs.energy as number;
    const first = (await p.call("POST", "/api/game/read", { book: "quran" })).json();
    expect(first.calm).toBe(true);
    expect(first.needs.energy).toBeCloseTo(Math.min(100, e0 + READ_GIVES.energy), 0);
    expect((await p.call("POST", "/api/game/read", { book: "bible" })).json().calm).toBe(false);
    expect((await p.call("POST", "/api/game/read", { book: "comics" })).statusCode).toBe(400);
  });
});
