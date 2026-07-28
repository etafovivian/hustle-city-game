// Local/dev seed: release switches, mock merchants (clearly flagged is_mock) and a dev admin.
// Idempotent — safe to run repeatedly.
import { DEFAULT_AVATAR } from "@hc/shared";
import { sql } from "drizzle-orm";
import { createDb, hashPassword } from "./index.js";
import { billboards, businesses, featureFlags, products, profiles, users } from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const { db, client } = createDb(url, { max: 1 });

const FLAGS = [
  { key: "checkout", description: "Paid checkout for retail orders" },
  { key: "withdrawals", description: "NGN payouts to bank accounts" },
  { key: "sponsored_rewards", description: "Cash rewards from funded sponsor campaigns" },
  { key: "multiplayer", description: "Real-time shared rooms" },
  { key: "trading", description: "Player-to-player virtual item trading" },
];
await db.insert(featureFlags).values(FLAGS.map((f) => ({ ...f, enabled: false }))).onConflictDoNothing();

// Billboards on the map. Prices are placeholder beta launch prices; change them in the table.
const BOARDS = [
  { key: "junction-101", name: "Junction 101 Roundabout", tier: "mega", priceKoboPerWeek: 60_000_00, capacity: 12 },
  { key: "third-mainland", name: "Third Mainland Bridge", tier: "mega", priceKoboPerWeek: 60_000_00, capacity: 12 },
  { key: "danfo-terminal", name: "Danfo Terminal", tier: "mega", priceKoboPerWeek: 45_000_00, capacity: 10 },
  { key: "island-heights", name: "Island Heights", tier: "mega", priceKoboPerWeek: 45_000_00, capacity: 10 },
  { key: "tech-mile", name: "Tech Mile", tier: "standard", priceKoboPerWeek: 25_000_00, capacity: 8 },
  { key: "owambe-gardens", name: "Owambe Gardens", tier: "standard", priceKoboPerWeek: 25_000_00, capacity: 8 },
  { key: "airport-ridge", name: "Airport Ridge", tier: "standard", priceKoboPerWeek: 25_000_00, capacity: 8 },
  { key: "lekki-gardens", name: "Lekki Gardens", tier: "standard", priceKoboPerWeek: 25_000_00, capacity: 8 },
];
await db.insert(billboards).values(BOARDS).onConflictDoNothing();

// Mock catalogue — electronics retail and repair artisans (initial recruiting hypothesis).
type MockBusiness = {
  name: string;
  kind: "retail" | "artisan" | "office";
  category: string;
  serviceArea: string;
  pickupAddress: string | null;
  description: string;
  products: { name: string; priceNaira: number; stockStatus?: string }[];
};
const MOCK: MockBusiness[] = [
  {
    name: "Bright Gadgets (demo)",
    kind: "retail",
    category: "electronics",
    serviceArea: "Yaba, Lagos",
    pickupAddress: "Demo pickup point, Yaba",
    description: "Phones, accessories and power solutions. Demo listing for testing.",
    products: [
      { name: "20,000mAh power bank", priceNaira: 18500 },
      { name: "Type-C fast charger", priceNaira: 6500 },
      { name: "Bluetooth earbuds", priceNaira: 14000, stockStatus: "low_stock" },
    ],
  },
  {
    name: "Ikenna Generator Repairs (demo)",
    kind: "artisan",
    category: "generator_repair",
    serviceArea: "Yaba, Surulere, Lagos",
    pickupAddress: null,
    description: "Small generator servicing and repair. Quotes on request. Demo listing for testing.",
    products: [
      { name: "Generator servicing (call-out from)", priceNaira: 10000 },
      { name: "Carburettor cleaning", priceNaira: 7500 },
    ],
  },
  {
    name: "FixIt Phone Clinic (demo)",
    kind: "artisan",
    category: "phone_repair",
    serviceArea: "Yaba, Lagos",
    pickupAddress: "Demo pickup point, Yaba",
    description: "Screen replacement and charging-port repair. Demo listing for testing.",
    products: [
      { name: "Screen replacement (from)", priceNaira: 25000 },
      { name: "Charging port repair", priceNaira: 8000 },
    ],
  },
];

for (const m of MOCK) {
  const existing = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(sql`${businesses.name} = ${m.name} and ${businesses.isMock}`);
  if (existing.length) continue;
  const [biz] = await db
    .insert(businesses)
    .values({
      name: m.name,
      kind: m.kind,
      category: m.category,
      serviceArea: m.serviceArea,
      pickupAddress: m.pickupAddress,
      description: m.description,
      status: "published",
      isMock: true,
    })
    .returning({ id: businesses.id });
  await db.insert(products).values(
    m.products.map((p) => ({
      businessId: biz!.id,
      name: p.name,
      priceKobo: p.priceNaira * 100,
      stockStatus: p.stockStatus ?? "in_stock",
    })),
  );
}

// Dev admin for local testing only. Credentials come from .env (see .env.example).
const adminEmail = process.env.DEV_ADMIN_EMAIL;
const adminPassword = process.env.DEV_ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const found = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = lower(${adminEmail})`);
  if (!found.length) {
    const [u] = await db
      .insert(users)
      .values({ email: adminEmail, passwordHash: await hashPassword(adminPassword), roles: ["player", "admin"] })
      .returning({ id: users.id });
    await db.insert(profiles).values({ userId: u!.id, nickname: "city_ops", avatar: DEFAULT_AVATAR });
    console.log(`dev admin created: ${adminEmail}`);
  }
}

await client.end();
console.log("seed complete");
