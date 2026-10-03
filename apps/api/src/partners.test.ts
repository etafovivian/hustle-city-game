// Love life: meet someone where they hang out, get closer (chats count a few times a day, a gift a day, dates),
// ask out (one partner at a time), move in (needs your own home), propose, marry (coins), break up.
import { NEED, chatPromptFor, NPC_BY_KEY, WEDDING } from "@hc/shared";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer } from "./test/harness.js";

let app: Awaited<ReturnType<typeof testServer>>;
let sql: ReturnType<typeof postgres>;
beforeAll(async () => {
  await prepareDatabase();
  app = await testServer();
  sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
});
afterAll(async () => {
  await sql?.end();
  await app?.close();
});
beforeEach(async () => {
  await resetDatabase();
});

describe("love life", () => {
  it("meets where they hang out, gets closer by chatting, gifts and dates", async () => {
    const p = await registerPlayer(app);
    await sql`update profiles set coin_balance = 100000 where user_id = ${p.id}`;
    expect((await p.call("PUT", "/api/love/pref", { pref: "women" })).json().pref).toBe("women");
    // Not at her place: no meeting.
    expect((await p.call("POST", "/api/love/zainab/meet", { at: "skyline_lounge" })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/love/zainab/chat", { answer: 0 })).statusCode).toBe(409);
    const met = await p.call("POST", "/api/love/zainab/meet", { at: "general_hospital" });
    expect(met.statusCode).toBe(201);
    expect(met.json().bonds[0]).toMatchObject({ npc: "zainab", stage: "met", closeness: 5 });
    // Her favourite answer brings you closest.
    const zainab = NPC_BY_KEY.get("zainab")!;
    const prompt = chatPromptFor("zainab", 0);
    const best = Math.max(0, prompt.answers.findIndex((a) => a.trait === zainab.traits[0]));
    const c1 = (await p.call("POST", "/api/love/zainab/chat", { answer: best })).json();
    expect(c1.gained).toBeGreaterThan(0);
    // Only a few chats a day count.
    for (let i = 0; i < 4; i++) await p.call("POST", "/api/love/zainab/chat", { answer: 0 });
    const love = (await p.call("GET", "/api/love")).json();
    expect(love.bonds[0].chatsLeft).toBe(0);
    const before = love.bonds[0].closeness;
    // A gift she likes, once a day.
    expect((await p.call("POST", "/api/love/zainab/gift", { gift: "flowers" })).json().gained).toBe(10);
    expect((await p.call("POST", "/api/love/zainab/gift", { gift: "flowers" })).statusCode).toBe(409);
    // A date at her favourite spot (you're friends by now).
    const d = await p.call("POST", "/api/love/zainab/date", { venue: "mallam_suya" });
    expect(d.statusCode).toBe(200);
    expect(d.json().fav).toBe(true);
    expect(d.json().love.bonds[0].closeness).toBe(before + 10 + 18);
    // Another date soon after costs again but doesn't count.
    expect((await p.call("POST", "/api/love/zainab/date", { venue: "mallam_suya" })).json().gained).toBe(0);
    expect((await p.call("GET", "/api/me")).json().coins).toBe(100000 - 600 - 1200 - 1200);
  });

  it("asks out (one partner at a time), moves in with a home, proposes, marries and can break up", async () => {
    const p = await registerPlayer(app);
    await sql`update profiles set coin_balance = 100000 where user_id = ${p.id}`;
    await p.call("POST", "/api/love/adaeze/meet", { at: "tailors_row" });
    await p.call("POST", "/api/love/priya/meet", { at: "city_library" });
    expect((await p.call("POST", "/api/love/adaeze/ask-out")).statusCode).toBe(409);
    await sql`update partner_bonds set closeness = ${NEED.askOut}, stage = 'friends' where user_id = ${p.id}`;
    expect((await p.call("POST", "/api/love/adaeze/ask-out")).json().partner).toBe("adaeze");
    expect((await p.call("POST", "/api/love/priya/ask-out")).json().error).toBe("taken");
    // No home of your own yet.
    await sql`update partner_bonds set closeness = ${NEED.moveIn} where user_id = ${p.id} and npc = 'adaeze'`;
    expect((await p.call("POST", "/api/love/adaeze/move-in")).json().error).toBe("no_home");
    await sql`insert into player_plots (user_id, plot_id, design, is_home) values (${p.id}, 'test-plot-1', 'bungalow', true)`;
    expect((await p.call("POST", "/api/love/adaeze/move-in")).json().bonds.find((b: { npc: string }) => b.npc === "adaeze").stage).toBe("living");
    // A partner at home: sleeping there lifts Social too.
    const social0 = (await p.call("GET", "/api/game/needs")).json().needs.social as number;
    const rest = await p.call("POST", "/api/game/home/rest", {});
    expect(rest.statusCode).toBe(200);
    expect(rest.json().needs.social).toBeGreaterThan(social0 + 5);
    await sql`update partner_bonds set closeness = ${NEED.propose} where user_id = ${p.id} and npc = 'adaeze'`;
    expect((await p.call("POST", "/api/love/adaeze/propose")).statusCode).toBe(200);
    const coins = (await p.call("GET", "/api/me")).json().coins as number;
    const wed = (await p.call("POST", "/api/love/adaeze/wedding")).json();
    expect(wed.bonds.find((b: { npc: string }) => b.npc === "adaeze").stage).toBe("married");
    expect((await p.call("GET", "/api/me")).json().coins).toBe(coins - WEDDING.cost);
    expect((await p.call("POST", "/api/love/adaeze/break-up")).json().partner).toBeNull();
    expect((await p.call("POST", "/api/love/priya/ask-out")).statusCode).toBe(200);
  });
});
