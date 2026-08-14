// Retail listings: shops register with products, an address and a phone; admins publish and verify them.
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
async function admin(): Promise<Player> {
  const p = await registerPlayer(app);
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  await sql`update users set roles = array['player','admin'] where id = ${p.id}`;
  await sql.end();
  return p;
}
const shop = {
  kind: "retail",
  name: "Mama Bisi Provisions",
  category: "provisions",
  areas: ["Yaba"],
  pickupAddress: "12 Herbert Macaulay Way, Yaba",
  contactPhone: "0803 123 4567",
  description: "Rice, beans, garri, noodles and drinks. Open daily from 7am.",
  services: [{ name: "Bag of rice (50kg)", fromPriceNaira: 78000 }],
};

describe("retail listings", () => {
  it("registers a shop, publishes it, verifies it, and lists it verified first", async () => {
    const owner = await registerPlayer(app);
    const res = await owner.call("POST", "/api/businesses", shop);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ kind: "retail", verified: false, status: "pending_review" });
    const id = res.json().id;
    const mod = await admin();
    await mod.call("POST", `/api/admin/businesses/${id}/review`, { decision: "publish", reasonCode: "meets_guidelines" });
    expect((await owner.call("POST", `/api/admin/businesses/${id}/verify`, { verified: true })).statusCode).toBe(403);
    expect((await mod.call("POST", `/api/admin/businesses/${id}/verify`, { verified: true })).json()).toMatchObject({ verified: true });
    const list = (await app.inject({ method: "GET", url: "/api/market/businesses?category=provisions" })).json();
    expect(list[0]).toMatchObject({ name: "Mama Bisi Provisions", kind: "retail", verified: true, contactPhone: "08031234567", pickupAddress: shop.pickupAddress });
    expect(list[0].products[0]).toMatchObject({ name: "Bag of rice (50kg)", priceKobo: 7_800_000 });
  });

  it("needs a retail category, an address and a real phone number", async () => {
    const owner = await registerPlayer(app);
    expect((await owner.call("POST", "/api/businesses", { ...shop, category: "plumber" })).statusCode).toBe(400);
    expect((await owner.call("POST", "/api/businesses", { ...shop, pickupAddress: "" })).statusCode).toBe(400);
    expect((await owner.call("POST", "/api/businesses", { ...shop, contactPhone: "12345" })).statusCode).toBe(400);
  });
});
