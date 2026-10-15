// Pickup reservations: reserve, the shop confirms, collected; the customer can cancel; nobody else can act.
import postgres from "postgres";
import { RESERVE } from "@hc/shared";
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
async function liveShop(owner: Player) {
  const biz = (
    await owner.call("POST", "/api/businesses", {
      kind: "retail",
      name: "Iya Basira Stores",
      category: "provisions",
      areas: ["Yaba"],
      pickupAddress: "12 Herbert Macaulay Way, Yaba",
      description: "Rice, beans, garri, noodles and drinks every day.",
      contactPhone: "08031234567",
      services: [{ name: "Bag of rice (50kg)", fromPriceNaira: 78_000 }],
    })
  ).json();
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql`update businesses set status = 'published' where id = ${biz.id}`;
  const [p] = await sql`select id from products where business_id = ${biz.id}`;
  await sql.end();
  return { shop: biz.id as string, product: p!.id as string };
}

describe("reservations", () => {
  it("reserve, confirm, collect; cancel; limits", async () => {
    const owner = await registerPlayer(app, "shop_owner");
    const buyer = await registerPlayer(app, "buyer_one");
    const stranger = await registerPlayer(app);
    const { shop, product } = await liveShop(owner);
    expect((await owner.call("POST", `/api/products/${product}/reserve`, { qty: 1 })).statusCode).toBe(409); // own shop
    const r = (await buyer.call("POST", `/api/products/${product}/reserve`, { qty: 2, note: "Coming at 5" })).json();
    expect(r).toMatchObject({ status: "requested", qty: 2, product: "Bag of rice (50kg)", businessName: "Iya Basira Stores" });
    expect(r.code).toMatch(/^RS-/);
    expect((await owner.call("GET", `/api/businesses/${shop}/reservations`)).json()[0]).toMatchObject({ id: r.id, customer: "buyer_one", note: "Coming at 5" });
    expect((await stranger.call("GET", `/api/businesses/${shop}/reservations`)).statusCode).toBe(404);
    expect((await buyer.call("POST", `/api/reservations/${r.id}/confirm`)).statusCode).toBe(404); // only the shop confirms
    expect((await owner.call("POST", `/api/reservations/${r.id}/collected`)).statusCode).toBe(409); // not confirmed yet
    expect((await owner.call("POST", `/api/reservations/${r.id}/confirm`)).json().status).toBe("confirmed");
    expect((await owner.call("POST", `/api/reservations/${r.id}/collected`)).json().status).toBe("collected");
    expect((await buyer.call("POST", `/api/reservations/${r.id}/cancel`)).statusCode).toBe(409);
    // Cancel, and at most a few open at once.
    const c = (await buyer.call("POST", `/api/products/${product}/reserve`, { qty: 1 })).json();
    expect((await buyer.call("POST", `/api/reservations/${c.id}/cancel`)).json().status).toBe("cancelled");
    for (let i = 0; i < RESERVE.maxOpen; i++) expect((await buyer.call("POST", `/api/products/${product}/reserve`, { qty: 1 })).statusCode).toBe(201);
    expect((await buyer.call("POST", `/api/products/${product}/reserve`, { qty: 1 })).statusCode).toBe(409);
    expect((await buyer.call("GET", "/api/reservations/mine")).json()).toHaveLength(RESERVE.maxOpen + 2);
  });
});
