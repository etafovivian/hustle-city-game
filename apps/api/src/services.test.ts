// Stage B1: artisan onboarding, admin review and the quote journey end to end, with access control.
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

async function makeAdmin(p: Player) {
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  await sql`update users set roles = array['player','admin'] where id = ${p.id}`;
  await sql.end();
}

/** An artisan with a published workshop, a customer and an outsider. */
async function cast() {
  const artisan = await registerPlayer(app);
  const customer = await registerPlayer(app);
  const outsider = await registerPlayer(app);
  const admin = await registerPlayer(app);
  await makeAdmin(admin);
  const created = await artisan.call("POST", "/api/businesses", {
    name: "Tunde Gen Repairs",
    category: "generator_repair",
    areas: ["Yaba", "Surulere"],
    description: "Small generator servicing, carburettor and coil repairs.",
    services: [{ name: "Call-out", fromPriceNaira: 5000 }],
  });
  expect(created.statusCode).toBe(201);
  const biz = created.json();
  expect(biz.status).toBe("pending_review");
  await admin.call("POST", `/api/admin/businesses/${biz.id}/review`, { decision: "publish", reasonCode: "meets_guidelines" });
  return { artisan, customer, outsider, admin, biz };
}

describe("artisan onboarding and review", () => {
  it("keeps new workshops out of search until an admin publishes them", async () => {
    const artisan = await registerPlayer(app);
    const admin = await registerPlayer(app);
    await makeAdmin(admin);
    const biz = (
      await artisan.call("POST", "/api/businesses", { name: "Ada Tailoring", category: "tailor", areas: ["Lekki"], description: "Aso-ebi, agbada and alterations." })
    ).json();
    const search = async () => (await app.inject({ method: "GET", url: "/api/market/businesses?category=tailor" })).json();
    expect(await search()).toHaveLength(0);

    expect((await artisan.call("POST", `/api/admin/businesses/${biz.id}/review`, { decision: "publish", reasonCode: "meets_guidelines" })).statusCode).toBe(403);
    const queue = (await admin.call("GET", "/api/admin/businesses")).json();
    expect(queue.map((b: { id: string }) => b.id)).toContain(biz.id);
    await admin.call("POST", `/api/admin/businesses/${biz.id}/review`, { decision: "publish", reasonCode: "meets_guidelines" });
    const found = await search();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: "Ada Tailoring", kind: "artisan", rating: null });

    await admin.call("POST", `/api/admin/businesses/${biz.id}/review`, { decision: "hide", reasonCode: "offensive", note: "Rename please" });
    expect(await search()).toHaveLength(0);
    expect((await artisan.call("GET", "/api/businesses/mine")).json()[0]).toMatchObject({ status: "hidden", reviewNote: "Rename please" });
  });

  it("validates categories and areas", async () => {
    const p = await registerPlayer(app);
    const bad = await p.call("POST", "/api/businesses", { name: "X Repairs", category: "rockets", areas: ["Mars"], description: "We fix everything you can imagine." });
    expect(bad.statusCode).toBe(400);
  });
});

describe("quote journey", () => {
  it("runs request → quote → revision → accept → done → confirm → review", async () => {
    const { artisan, customer, biz } = await cast();
    const req = await customer.call("POST", "/api/services/requests", { businessId: biz.id, description: "My 2.5kVA gen won't start since Sunday.", serviceArea: "Yaba" });
    expect(req.statusCode).toBe(201);
    const id = req.json().id;
    expect(req.json()).toMatchObject({ role: "customer", status: "requested", yourTurn: false });

    const inbox = (await artisan.call("GET", "/api/services/requests")).json();
    expect(inbox[0]).toMatchObject({ id, role: "artisan", yourTurn: true, status: "requested" });
    expect(inbox[0].counterpart).toMatch(/^@/);

    const q1 = await artisan.call("POST", `/api/services/requests/${id}/quote`, {
      items: [
        { label: "Call-out", amountKobo: 500_000 },
        { label: "Carburettor clean", amountKobo: 750_000 },
      ],
      appointmentAt: inDays(2),
      note: "Can come Tuesday morning.",
    });
    expect(q1.statusCode).toBe(200);
    expect(q1.json()).toMatchObject({ status: "quoted", latestTotalKobo: 1_250_000 });

    const q2 = await artisan.call("POST", `/api/services/requests/${id}/quote`, {
      items: [
        { label: "Call-out", amountKobo: 500_000 },
        { label: "Carburettor clean", amountKobo: 650_000 },
      ],
      appointmentAt: inDays(3),
    });
    expect(q2.json().quotes).toHaveLength(2);

    // Accepting an old version fails: the customer must see the latest quote.
    expect((await customer.call("POST", `/api/services/requests/${id}/accept`, { version: 1 })).statusCode).toBe(409);
    const accepted = await customer.call("POST", `/api/services/requests/${id}/accept`, { version: 2 });
    expect(accepted.json()).toMatchObject({ status: "scheduled", latestTotalKobo: 1_150_000 });
    expect(accepted.json().scheduledFor).toBeTruthy();

    // Extra charges after booking need the customer's approval again.
    const extra = await artisan.call("POST", `/api/services/requests/${id}/quote`, {
      items: [
        { label: "Call-out", amountKobo: 500_000 },
        { label: "Carburettor clean", amountKobo: 650_000 },
        { label: "New spark plug", amountKobo: 300_000 },
      ],
      appointmentAt: inDays(3),
      note: "Plug is worn out.",
    });
    expect(extra.json()).toMatchObject({ status: "quoted", scheduledFor: null });
    await customer.call("POST", `/api/services/requests/${id}/accept`, { version: 3 });

    expect((await customer.call("POST", `/api/services/requests/${id}/confirm`, {})).statusCode).toBe(409);
    await artisan.call("POST", `/api/services/requests/${id}/complete`, { note: "Running fine now." });
    const reopened = await customer.call("POST", `/api/services/requests/${id}/not-done`, { note: "Still smoking." });
    expect(reopened.json().status).toBe("scheduled");
    await artisan.call("POST", `/api/services/requests/${id}/complete`, {});
    const done = await customer.call("POST", `/api/services/requests/${id}/confirm`, {});
    expect(done.json()).toMatchObject({ status: "completed", can: ["review"] });

    const rev = await customer.call("POST", `/api/services/requests/${id}/review`, { rating: 5, body: "Quick and honest." });
    expect(rev.json().review).toMatchObject({ rating: 5 });
    expect((await customer.call("POST", `/api/services/requests/${id}/review`, { rating: 1 })).statusCode).toBe(409);

    const listed = (await app.inject({ method: "GET", url: "/api/market/businesses?category=generator_repair" })).json();
    expect(listed[0].rating).toEqual({ average: 5, count: 1 });

    const history = (await customer.call("GET", `/api/services/requests/${id}`)).json();
    expect(history.quotes.map((q: { version: number }) => q.version)).toEqual([1, 2, 3]);
    expect(history.events.map((e: { type: string }) => e.type)).toEqual(["requested", "quote", "quote", "accept", "quote", "accept", "complete", "not_done", "complete", "confirm", "review"]);
  });

  it("blocks other accounts and the wrong party", async () => {
    const { artisan, customer, outsider, biz } = await cast();
    const id = (await customer.call("POST", "/api/services/requests", { businessId: biz.id, description: "Phone screen cracked, need replacing.", serviceArea: "Surulere" })).json().id;

    expect((await outsider.call("GET", `/api/services/requests/${id}`)).statusCode).toBe(404);
    expect((await outsider.call("POST", `/api/services/requests/${id}/quote`, { items: [{ label: "Screen", amountKobo: 100 }], appointmentAt: inDays(1) })).statusCode).toBe(404);
    expect((await outsider.call("GET", "/api/services/requests")).json()).toHaveLength(0);

    // The customer can't quote their own request; the artisan can't accept.
    expect((await customer.call("POST", `/api/services/requests/${id}/quote`, { items: [{ label: "Screen", amountKobo: 100 }], appointmentAt: inDays(1) })).statusCode).toBe(409);
    await artisan.call("POST", `/api/services/requests/${id}/quote`, { items: [{ label: "Screen", amountKobo: 2_500_000 }], appointmentAt: inDays(1) });
    expect((await artisan.call("POST", `/api/services/requests/${id}/accept`, { version: 1 })).statusCode).toBe(409);

    // An artisan can't request a quote from their own business, or quote nonsense.
    expect((await artisan.call("POST", "/api/services/requests", { businessId: biz.id, description: "Testing my own workshop here.", serviceArea: "Yaba" })).statusCode).toBe(422);
    const bad = await artisan.call("POST", `/api/services/requests/${id}/quote`, { items: [{ label: "Screen", amountKobo: 100 }], appointmentAt: inDays(-1) });
    expect(bad.statusCode).toBe(400);
  });

  it("only takes requests for published artisans and caps open requests", async () => {
    const { customer, biz, admin } = await cast();
    const ask = () => customer.call("POST", "/api/services/requests", { businessId: biz.id, description: "AC not cooling, please check it.", serviceArea: "Yaba" });
    for (let i = 0; i < 3; i++) expect((await ask()).statusCode).toBe(201);
    expect((await ask()).statusCode).toBe(422);

    await admin.call("POST", `/api/admin/businesses/${biz.id}/review`, { decision: "hide", reasonCode: "other" });
    const other = await registerPlayer(app);
    expect((await other.call("POST", "/api/services/requests", { businessId: biz.id, description: "AC not cooling, please check it.", serviceArea: "Yaba" })).statusCode).toBe(404);
  });

  it("keeps quote history append-only", async () => {
    const { artisan, customer, biz } = await cast();
    const id = (await customer.call("POST", "/api/services/requests", { businessId: biz.id, description: "Laptop hinge broken on one side.", serviceArea: "Yaba" })).json().id;
    await artisan.call("POST", `/api/services/requests/${id}/quote`, { items: [{ label: "Hinge", amountKobo: 900_000 }], appointmentAt: inDays(1) });
    const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
    await expect(sql`update quote_versions set total_kobo = 1 where request_id = ${id}`).rejects.toThrow(/append-only/);
    await expect(sql`delete from service_events where request_id = ${id}`).rejects.toThrow(/append-only/);
    await sql.end();
  });
});
