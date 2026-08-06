// Local/dev seed: release switches, mock merchants (clearly flagged is_mock) and a dev admin.
// Idempotent — safe to run repeatedly.
import { DEFAULT_AVATAR } from "@hc/shared";
import { sql } from "drizzle-orm";
import { createDb, hashPassword } from "./index.js";
import { billboards, businesses, courseModules, courses, featureFlags, lessons, products, profiles, quizQuestions, users } from "./schema.js";

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

// Hustle Academy: a starter tech course, created once as a DRAFT so the owner can add YouTube links, edit and publish.
const STARTER = {
  slug: "web-basics",
  title: "Web Basics: Your First Web Page",
  summary: "How the web works, then build and style a simple page with HTML and CSS. No experience needed.",
  category: "software",
  level: "beginner",
  modules: [
    {
      title: "How the web works",
      lessons: [
        { title: "What happens when you open a website", body: "When you type an address, your phone asks a DNS server where that site lives, then your browser asks that server for the page.\n\nThe server sends back files: HTML for the content, CSS for the look, and JavaScript for anything that moves or reacts. Your browser puts them together into the page you see." },
        { title: "Browsers, servers and URLs", body: "A URL has parts: https:// is the secure way to talk; the domain (like example.com) names the site; the path after it (/about) names the page.\n\nYour browser is the client. The computer that answers is the server. Every website you use is this conversation, many times a second." },
      ],
      questions: [
        { prompt: "What turns a domain name into the server's address?", options: ["DNS", "CSS", "HTML", "A browser tab"], answer: 0, explanation: "DNS is the internet's phone book." },
        { prompt: "Which file type holds a page's content?", options: ["CSS", "HTML", "JPEG", "ZIP"], answer: 1, explanation: "HTML is the content; CSS is the look." },
        { prompt: "In https://example.com/about, what is /about?", options: ["The domain", "The protocol", "The path", "The server"], answer: 2, explanation: "The path names a page on the site." },
        { prompt: "What does the 's' in https mean?", options: ["Slow", "Secure", "Static", "Server"], answer: 1, explanation: "The connection is encrypted." },
      ],
    },
    {
      title: "Build your first page",
      lessons: [
        { title: "HTML tags", body: "HTML wraps content in tags. <h1> is the main heading, <p> is a paragraph, <a href=\"...\"> is a link and <img src=\"...\"> shows a picture.\n\nMost tags open and close: <p>Hello</p>. Write your name in an <h1> and a sentence about your hustle in a <p>." },
        { title: "Style it with CSS", body: "CSS chooses colours, sizes and spacing. A rule names what to style and how: h1 { color: green; }.\n\nTry a background colour for the page (body { background: #fffaf0; }) and a bigger font for your heading." },
      ],
      questions: [
        { prompt: "Which tag is the main heading?", options: ["<p>", "<h1>", "<a>", "<img>"], answer: 1, explanation: "<h1> is the biggest heading." },
        { prompt: "Which tag makes a link?", options: ["<a>", "<link-to>", "<p>", "<url>"], answer: 0, explanation: "<a href=\"...\"> links to another page." },
        { prompt: "What does CSS control?", options: ["The server", "How the page looks", "The domain name", "The Wi-Fi"], answer: 1, explanation: "CSS is the look: colours, sizes, spacing." },
        { prompt: "Which CSS rule makes headings green?", options: ["h1 { color: green; }", "<h1 green>", "green(h1)", "h1 = green"], answer: 0, explanation: "A selector, then properties in braces." },
      ],
    },
  ],
};
const [starter] = await db
  .insert(courses)
  .values({ slug: STARTER.slug, title: STARTER.title, summary: STARTER.summary, category: STARTER.category, level: STARTER.level, status: "draft" })
  .onConflictDoNothing()
  .returning({ id: courses.id });
if (starter) {
  for (const [i, m] of STARTER.modules.entries()) {
    const [mod] = await db.insert(courseModules).values({ courseId: starter.id, position: i + 1, title: m.title, quizSize: 3, passPercent: 70 }).returning({ id: courseModules.id });
    await db.insert(lessons).values(m.lessons.map((l, j) => ({ moduleId: mod!.id, position: j + 1, title: l.title, kind: "text", body: l.body, minSeconds: 90 })));
    await db.insert(quizQuestions).values(m.questions.map((q) => ({ moduleId: mod!.id, ...q })));
  }
  console.log("academy starter course created (draft)");
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
