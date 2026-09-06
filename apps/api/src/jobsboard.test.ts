// Jobs board: verified businesses post, players apply once with a contact, the business sees certificates and
// shortlists; unverified businesses can't post; scams (links, phones in text) are refused.
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
const run = async (fn: (sql: postgres.Sql) => Promise<unknown>) => {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await fn(sql);
  await sql.end();
};
async function shop(owner: Player, verified: boolean) {
  const biz = (
    await owner.call("POST", "/api/businesses", { kind: "retail", name: "Bisi Fabrics", category: "fashion_fabrics", areas: ["Yaba"], pickupAddress: "4 Tejuosho Market, Yaba", description: "Ankara, lace and aso-oke for every occasion.", contactPhone: "08031234567", services: [{ name: "Ankara (6 yards)", fromPriceNaira: 9000 }] })
  ).json();
  await run((sql) => sql`update businesses set status = 'published', verified_at = ${verified ? new Date() : null} where id = ${biz.id}`);
  return biz.id as string;
}
const job = { title: "Sales assistant", kind: "full_time", pay: "₦80,000 a month", area: "Yaba", description: "Help customers pick fabric, keep the shop tidy, and count stock at closing.", wantsCertificate: false };

describe("jobs board", () => {
  it("posts, applies once, shows certificates, shortlists", async () => {
    const owner = await registerPlayer(app, "bisi_owner");
    const seeker = await registerPlayer(app, "job_seeker");
    const unverified = await registerPlayer(app);
    const id = await shop(owner, true);
    const other = await shop(unverified, false);
    expect((await unverified.call("POST", `/api/businesses/${other}/vacancies`, job)).statusCode).toBe(409);
    expect((await owner.call("POST", `/api/businesses/${id}/vacancies`, { ...job, description: "Call 08031234567 or visit http://scam.example now please" })).statusCode).toBe(400);
    const v = (await owner.call("POST", `/api/businesses/${id}/vacancies`, job)).json();
    expect(v).toMatchObject({ title: "Sales assistant", businessName: "Bisi Fabrics", verified: true, status: "open" });
    const list = (await seeker.call("GET", "/api/vacancies")).json();
    expect(list).toEqual([expect.objectContaining({ id: v.id, applied: false })]);
    expect((await seeker.call("POST", `/api/vacancies/${v.id}/apply`, { message: "I sold fabric at Balogun for two years.", contact: "12345" })).statusCode).toBe(400);
    expect((await owner.call("POST", `/api/vacancies/${v.id}/apply`, { message: "Applying to my own shop here.", contact: "08030000000" })).statusCode).toBe(409);
    expect((await seeker.call("POST", `/api/vacancies/${v.id}/apply`, { message: "I sold fabric at Balogun for two years.", contact: "0803 999 8888" })).statusCode).toBe(201);
    expect((await seeker.call("POST", `/api/vacancies/${v.id}/apply`, { message: "Again, I sold fabric for years.", contact: "08039998888" })).statusCode).toBe(409);
    expect((await seeker.call("GET", "/api/vacancies")).json()[0].applied).toBe(true);
    expect((await owner.call("GET", `/api/businesses/${id}/vacancies`)).json()[0].applications).toBe(1);
    expect((await seeker.call("GET", `/api/vacancies/${v.id}/applications`)).statusCode).toBe(404);
    const apps = (await owner.call("GET", `/api/vacancies/${v.id}/applications`)).json();
    expect(apps).toEqual([expect.objectContaining({ nickname: "job_seeker", contact: "08039998888", status: "new", certificates: [], degrees: [] })]);
    expect((await owner.call("POST", `/api/applications/${apps[0].id}/status`, { status: "shortlisted" })).statusCode).toBe(200);
    const ping = (await seeker.call("POST", "/api/presence", { x: 1, y: 1, place: null })).json().pings.find((p: { kind: string }) => p.kind === "note");
    expect(ping.text).toContain("shortlisted");
    await owner.call("POST", `/api/vacancies/${v.id}/close`);
    expect((await seeker.call("GET", "/api/vacancies")).json()).toEqual([]);
  });
});
