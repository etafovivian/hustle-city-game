// PostgreSQL is the source of truth for balances, inventory and transactions (PRD: System boundaries).
// Stage A tables plus the foundation (identity, roles, audit, flags) and the business/product
// tables needed for the mock merchant catalogue. Money-phase tables arrive in later migrations.

import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// --- Identity -------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    roles: text("roles").array().notNull().default(sql`ARRAY['player']::text[]`),
    status: text("status").notNull().default("active"), // active | suspended
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the opaque session token; the raw token only lives in the cookie.
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * One-time password reset links. Only the SHA-256 of the token is stored; the raw token is in the link.
 * Issued by an admin while email delivery isn't set up; each link works once and expires.
 */
export const passwordResets = pgTable(
  "password_resets",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    issuedBy: uuid("issued_by").references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    nicknameHidden: boolean("nickname_hidden").notNull().default(false),
    avatar: jsonb("avatar").notNull(),
    xp: integer("xp").notNull().default(0),
    // Onboarding choices (see @hc/shared onboarding.ts).
    hustle: text("hustle").notNull().default("trader"),
    dream: text("dream").notNull().default("market_royalty"),
    // Cached City Coin balance; every change is mirrored by a game_ledger_entries row.
    coinBalance: bigint("coin_balance", { mode: "number" }).notNull().default(0),
    introClaimedAt: timestamp("intro_claimed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profiles_nickname_lower_uq").on(sql`lower(${t.nickname})`),
    check("profiles_coin_balance_nonneg", sql`${t.coinBalance} >= 0`),
  ],
);

// --- Game economy (City Coins: no cash value) -----------------------------

export const gameLedgerEntries = pgTable(
  "game_ledger_entries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
    // signup_grant | restock | takings | order | quest_reward | intro_reward | decor | decor_refund | dream_reward | admin_adjustment
    kind: text("kind").notNull(),
    // Unique per user: makes every credit/debit idempotent.
    reference: text("reference").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("game_ledger_user_ref_uq").on(t.userId, t.reference),
    index("game_ledger_kind_created_idx").on(t.kind, t.createdAt),
    check("game_ledger_amount_nonzero", sql`${t.amount} <> 0`),
  ],
);

export const simShops = pgTable(
  "sim_shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // NPC demand has been simulated for all steps < settledStep.
    settledStep: bigint("settled_step", { mode: "number" }).notNull(),
    uncollected: bigint("uncollected", { mode: "number" }).notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sim_shops_owner_uq").on(t.ownerId)],
);

export const simInventory = pgTable(
  "sim_inventory",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => simShops.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    quantity: integer("quantity").notNull().default(0),
    price: integer("price").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.itemKey] }),
    check("sim_inventory_qty_nonneg", sql`${t.quantity} >= 0`),
    check("sim_inventory_price_pos", sql`${t.price} > 0`),
  ],
);

export const simOrders = pgTable(
  "sim_orders",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => simShops.id, { onDelete: "cascade" }),
    slot: bigint("slot", { mode: "number" }).notNull(),
    itemKey: text("item_key").notNull(),
    units: integer("units").notNull(),
    offer: integer("offer").notNull(),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.slot] })],
);

export const questProgress = pgTable(
  "quest_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Game day (YYYY-MM-DD) for daily quests, or 'intro' for onboarding steps.
    day: text("day").notNull(),
    questKey: text("quest_key").notNull(),
    progress: integer("progress").notNull().default(0),
    seenKeys: text("seen_keys").array().notNull().default(sql`ARRAY[]::text[]`),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.questKey] })],
);

/** Buy mode: furniture placed on a player's shop floor (see @hc/shared decor.ts). */
export const shopDecor = pgTable(
  "shop_decor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => simShops.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    rotation: integer("rotation").notNull().default(0),
    pricePaid: integer("price_paid").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("shop_decor_shop_idx").on(t.shopId), check("shop_decor_rotation_valid", sql`${t.rotation} between 0 and 3`)],
);

// --- Businesses and catalogue (mock merchants in Stage A) ------------------

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // retail | artisan | office
    category: text("category").notNull(),
    serviceArea: text("service_area").notNull(),
    // Real pickup address is kept regardless of the business's virtual location.
    pickupAddress: text("pickup_address"),
    description: text("description").notNull().default(""),
    templateKey: text("template_key").notNull().default("free_shop"),
    status: text("status").notNull().default("draft"), // draft | pending_review | published | hidden | rejected
    // Shown to the owner when admin review rejects or hides the listing.
    reviewNote: text("review_note"),
    isMock: boolean("is_mock").notNull().default(false),
    /** WhatsApp / phone the owner chose to show customers. */
    contactPhone: text("contact_phone"),
    /** Set by an admin after checking the business (phone, and CAC for bigger ones); null means not verified. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    /** Opening hours { days, open, close } (Lagos hours); null = not set. */
    hours: jsonb("hours"),
    createdAt: createdAt(),
  },
  (t) => [
    index("businesses_status_category_idx").on(t.status, t.category),
    check("businesses_kind_valid", sql`${t.kind} in ('retail','artisan','office')`),
  ],
);

export const businessMembers = pgTable(
  "business_members",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // owner | staff
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.userId] })],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // NGN amounts are always integer kobo.
    priceKobo: bigint("price_kobo", { mode: "number" }).notNull(),
    stockStatus: text("stock_status").notNull().default("in_stock"),
    photoUrl: text("photo_url"),
    status: text("status").notNull().default("published"), // published | hidden
    createdAt: createdAt(),
  },
  (t) => [
    index("products_business_idx").on(t.businessId),
    check("products_price_nonneg", sql`${t.priceKobo} >= 0`),
  ],
);

// --- Trust, safety and operations ----------------------------------------

// ── Stage B1: artisan quote journey ──────────────────────

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id),
    description: text("description").notNull(),
    serviceArea: text("service_area").notNull(),
    // requested | quoted | scheduled | completion_submitted | completed | declined | cancelled
    status: text("status").notNull().default("requested"),
    currentVersion: integer("current_version").notNull().default(0),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("service_requests_customer_idx").on(t.customerId, t.updatedAt),
    index("service_requests_business_idx").on(t.businessId, t.updatedAt),
    check(
      "service_requests_status_valid",
      sql`${t.status} in ('requested','quoted','scheduled','completion_submitted','completed','declined','cancelled')`,
    ),
  ],
);

/** Every quote and revision is kept (PRD: approved quote revisions are retained as versions). Append-only. */
export const quoteVersions = pgTable(
  "quote_versions",
  {
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id),
    version: integer("version").notNull(),
    items: jsonb("items").notNull(), // [{ label, amountKobo }]
    totalKobo: bigint("total_kobo", { mode: "number" }).notNull(),
    note: text("note").notNull().default(""),
    appointmentAt: timestamp("appointment_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.version] }), check("quote_versions_total_nonneg", sql`${t.totalKobo} >= 0`)],
);

/** The request's history, shown to both parties (also the in-app notification feed). Append-only. */
export const serviceEvents = pgTable(
  "service_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id),
    actorId: uuid("actor_id").references(() => users.id),
    actorRole: text("actor_role").notNull(), // customer | artisan | system
    type: text("type").notNull(),
    version: integer("version"),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("service_events_request_idx").on(t.requestId, t.id)],
);

/** Transaction reviews: one per completed request, by its customer. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(),
    body: text("body").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reviews_request_uq").on(t.requestId),
    index("reviews_business_idx").on(t.businessId),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
  ],
);

// ── Billboards: paid ads from real businesses on in-game boards ──

/** The boards on the map (positions live in the web layout, keyed by `key`). */
export const billboards = pgTable("billboards", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("standard"), // standard | mega
  priceKoboPerWeek: bigint("price_kobo_per_week", { mode: "number" }).notNull(),
  // How many ads take turns on the board at once.
  capacity: integer("capacity").notNull(),
  active: boolean("active").notNull().default(true),
});

export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advertiserId: uuid("advertiser_id")
      .notNull()
      .references(() => users.id),
    billboardKey: text("billboard_key")
      .notNull()
      .references(() => billboards.key),
    headline: text("headline").notNull(), // also the banner's alt text
    linkUrl: text("link_url").notNull(),
    weeks: integer("weeks").notNull(),
    // Price agreed at booking time (board prices can change later).
    priceKobo: bigint("price_kobo", { mode: "number" }).notNull(),
    reviewStatus: text("review_status").notNull().default("pending"), // pending | approved | rejected
    paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid | paid
    paymentReference: text("payment_reference"),
    reviewNote: text("review_note"),
    // Set when it's both approved and paid.
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("ad_campaigns_board_live_idx").on(t.billboardKey, t.endsAt),
    index("ad_campaigns_advertiser_idx").on(t.advertiserId, t.createdAt),
    check("ad_campaigns_weeks_range", sql`${t.weeks} between 1 and 4`),
    check("ad_campaigns_review_valid", sql`${t.reviewStatus} in ('pending','approved','rejected')`),
    check("ad_campaigns_payment_valid", sql`${t.paymentStatus} in ('unpaid','paid')`),
  ],
);

/** Banner images (WebP, 3:1), kept apart so campaign lists stay light. */
export const adCreatives = pgTable("ad_creatives", {
  campaignId: uuid("campaign_id")
    .primaryKey()
    .references(() => adCampaigns.id),
  contentType: text("content_type").notNull(),
  bytes: bytea("bytes").notNull(),
});

/** Views and clicks per campaign per Lagos day, for advertiser reports. */
export const adStats = pgTable(
  "ad_stats",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => adCampaigns.id),
    day: text("day").notNull(),
    views: integer("views").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.day] })],
);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => users.id),
  targetType: text("target_type").notNull(), // user | business | product | shop
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"), // open | actioned | dismissed
  createdAt: createdAt(),
});

// Append-only: UPDATE/DELETE are blocked by a trigger (see custom migration).
export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reasonCode: text("reason_code"),
    details: jsonb("details").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_target_idx").on(t.targetType, t.targetId)],
);

// Release switches (PRD): checkout, withdrawals, sponsored_rewards, multiplayer, trading.
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Hustle Academy (docs/academy-plan.md) --------------------------------

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    category: text("category").notNull(),
    level: text("level").notNull().default("beginner"),
    provider: text("provider").notNull().default("lampnet"), // lampnet | akuretechhub
    status: text("status").notNull().default("draft"), // draft | published
    rewardCoins: integer("reward_coins").notNull().default(500),
    rewardXp: integer("reward_xp").notNull().default(100),
    physicalCertKobo: bigint("physical_cert_kobo", { mode: "number" }).notNull().default(500_000),
    trainingFeeKobo: bigint("training_fee_kobo", { mode: "number" }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("courses_slug_uq").on(t.slug),
    check("courses_status_valid", sql`${t.status} in ('draft','published')`),
    check("courses_provider_valid", sql`${t.provider} in ('lampnet','akuretechhub')`),
  ],
);

export const courseModules = pgTable(
  "course_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    quizSize: integer("quiz_size").notNull().default(5),
    passPercent: integer("pass_percent").notNull().default(70),
  },
  (t) => [index("course_modules_course_idx").on(t.courseId, t.position), check("course_modules_pass_range", sql`${t.passPercent} between 1 and 100`)],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => courseModules.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("video"), // video | text
    youtubeId: text("youtube_id"),
    body: text("body").notNull().default(""),
    // Seconds a learner must spend on the lesson (server-timed) before it counts as done.
    minSeconds: integer("min_seconds").notNull().default(60),
  },
  (t) => [index("lessons_module_idx").on(t.moduleId, t.position), check("lessons_min_seconds_nonneg", sql`${t.minSeconds} >= 0`)],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => courseModules.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    answer: integer("answer").notNull(),
    explanation: text("explanation").notNull().default(""),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("quiz_questions_module_idx").on(t.moduleId)],
);

export const enrolments = pgTable(
  "enrolments",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    enrolledAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.courseId] })],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    seconds: integer("seconds").notNull().default(0),
    lastBeatAt: timestamp("last_beat_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => courseModules.id, { onDelete: "cascade" }),
    questionIds: jsonb("question_ids").$type<string[]>().notNull(),
    answers: jsonb("answers").$type<(number | null)[]>(),
    percent: integer("percent"),
    passed: boolean("passed"),
    startedAt: createdAt(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [index("quiz_attempts_user_module_idx").on(t.userId, t.moduleId, t.startedAt)],
);

// Append-only: certificates are never edited (a trigger blocks UPDATE/DELETE); revoking adds a row below.
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    holderName: text("holder_name").notNull(),
    courseTitle: text("course_title").notNull(),
    provider: text("provider").notNull(),
    kind: text("kind").notNull().default("virtual"), // virtual | physical
    issuedAt: createdAt(),
  },
  (t) => [
    uniqueIndex("certificates_number_uq").on(t.number),
    uniqueIndex("certificates_user_course_kind_uq").on(t.userId, t.courseId, t.kind),
    check("certificates_kind_valid", sql`${t.kind} in ('virtual','physical')`),
  ],
);

export const certificateRevocations = pgTable("certificate_revocations", {
  certificateId: uuid("certificate_id")
    .primaryKey()
    .references(() => certificates.id),
  reason: text("reason").notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: createdAt(),
});

/** Players who want a plot of land (ownership opens later; the owner contacts them first). One row per player and plot. */
export const landInterest = pgTable(
  "land_interest",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plotId: text("plot_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.plotId] })],
);

/** Paid trips across the map. The fare is charged when the ride starts; an area-boys stop is settled once. */
export const rides = pgTable(
  "rides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    units: integer("units").notNull(),
    fare: integer("fare").notNull(),
    stop: boolean("stop").notNull().default(false),
    stopChoice: text("stop_choice"),
    stopCost: integer("stop_cost"),
    createdAt: createdAt(),
  },
  (t) => [index("rides_user_created_idx").on(t.userId, t.createdAt)],
);

/** A business's building on the map: one plot per business, one business per plot (free in the beta). */
export const businessPlots = pgTable(
  "business_plots",
  {
    businessId: uuid("business_id")
      .primaryKey()
      .references(() => businesses.id, { onDelete: "cascade" }),
    plotId: text("plot_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("business_plots_plot_uq").on(t.plotId)],
);

/** Discounts a business honours in real life (owner decision: deals only, no airtime or cash rewards). */
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    terms: text("terms").notNull().default(""),
    // pending_review | live | rejected | ended
    status: text("status").notNull().default("pending_review"),
    maxClaims: integer("max_claims").notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reviewNote: text("review_note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("deals_business_idx").on(t.businessId),
    check("deals_status_valid", sql`${t.status} in ('pending_review','live','rejected','ended')`),
  ],
);

/** A player's one-time code for a deal; the business marks it used at the counter. */
export const dealClaims = pgTable(
  "deal_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("deal_claims_code_uq").on(t.code), uniqueIndex("deal_claims_deal_user_uq").on(t.dealId, t.userId)],
);

/** A player's needs as last saved (they run down from `updated_at`), and when each place's free action last filled them. */
export const playerNeeds = pgTable("player_needs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  needs: jsonb("needs").notNull(),
  freeAt: jsonb("free_at").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Shifts worked at each place's job (the rung follows from the count). */
export const playerJobs = pgTable(
  "player_jobs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    venue: text("venue").notNull(),
    shifts: integer("shifts").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.venue] })],
);

/** A player's own home: a plot bought with City Coins and the house built on it (one each for now). */
export const playerHomes = pgTable(
  "player_homes",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    plotId: text("plot_id").notNull(),
    design: text("design").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("player_homes_plot_uq").on(t.plotId)],
);

/** Vehicles a player owns. */
export const playerVehicles = pgTable(
  "player_vehicles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })],
);

/** Private messages between players. */
export const directMessages = pgTable(
  "direct_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromId: uuid("from_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toId: uuid("to_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("dm_to_created_idx").on(t.toId, t.createdAt), index("dm_from_created_idx").on(t.fromId, t.createdAt)],
);

/** Plots players own (up to a few each): empty land or a house; one of them can be their home. */
export const playerPlots = pgTable(
  "player_plots",
  {
    plotId: text("plot_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** House design, or null for empty land. */
    design: text("design"),
    isHome: boolean("is_home").notNull().default(false),
    /** Let out to a tenant since (rent builds up from here, or from the last collection). */
    letSince: timestamp("let_since", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("player_plots_user_idx").on(t.userId)],
);

/** Things a player has bought for their home (furniture and appliances). */
export const homeItems = pgTable(
  "home_items",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    /** Where it stands: a room key of the home and a spot in it (fractions of the room image); null = default spot. */
    room: text("room"),
    x: doublePrecision("x"),
    y: doublePrecision("y"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemKey] })],
);

/** A player's saved contacts (one-way: you add people you know). */
export const contacts = pgTable(
  "contacts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.contactId] })],
);

/** Daily counts of what players did with a business (card opens, search views, WhatsApp taps, directions). */
export const businessStats = pgTable(
  "business_stats",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    kind: text("kind").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.day, t.kind] })],
);

/** Lagoon City University: the programmes a player enrolled in (graduatedAt set at convocation). */
export const uniEnrolments = pgTable(
  "uni_enrolments",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    programme: text("programme").notNull(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    graduatedAt: timestamp("graduated_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.programme] })],
);

/** Each course: lectures attended, exam attempts, and when it was passed. */
export const uniCourses = pgTable(
  "uni_courses",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    course: text("course").notNull(),
    lectures: integer("lectures").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    passedAt: timestamp("passed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.course] })],
);

/** Lectures attended, one row each (for the daily limit). */
export const uniLectures = pgTable(
  "uni_lectures",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    course: text("course").notNull(),
    day: text("day").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("uni_lectures_user_day").on(t.userId, t.day)],
);

/** "Bring your crew": who invited whom (one inviter per player); rewardedAt once the friend really played. */
export const referrals = pgTable("referrals", {
  inviteeId: uuid("invitee_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  inviterId: uuid("inviter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
}, (t) => [index("referrals_inviter").on(t.inviterId)]);

/** "I'm coming" to a play night (event key + its Lagos date). */
export const playNightRsvps = pgTable(
  "play_night_rsvps",
  {
    event: text("event").notNull(),
    day: text("day").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.event, t.day, t.userId] })],
);

/** Small things a player carries (an umbrella…). */
export const playerItems = pgTable(
  "player_items",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    item: text("item").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.item] })],
);

/** Skill points per player (Charisma, Fitness, Cooking, Tech, Business). */
export const playerSkills = pgTable(
  "player_skills",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skill: text("skill").notNull(),
    points: integer("points").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skill] })],
);

/** A flat a player rents (one at a time). */
export const rentals = pgTable("rentals", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  unit: text("unit").notNull(),
  area: text("area").notNull(),
  /** The home building on the map the flat is in. */
  plotId: text("plot_id").notNull(),
  weekly: integer("weekly").notNull(),
  caution: integer("caution").notNull(),
  paidUntil: timestamp("paid_until", { withTimezone: true }).notNull(),
  startedAt: createdAt(),
});

/** A review of a shop, unlocked by a deal the reviewer actually redeemed there (one per claim). */
export const shopReviews = pgTable(
  "shop_reviews",
  {
    claimId: uuid("claim_id")
      .primaryKey()
      .references(() => dealClaims.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    body: text("body").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("shop_reviews_business_idx").on(t.businessId), check("shop_reviews_rating", sql`${t.rating} between 1 and 5`)],
);

/** A product reserved for pickup: the customer pays at the shop; the shop confirms, declines or marks it collected. */
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull(),
    note: text("note").notNull().default(""),
    code: text("code").notNull(),
    // requested | confirmed | declined | collected | cancelled
    status: text("status").notNull().default("requested"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("reservations_business_idx").on(t.businessId, t.status), index("reservations_user_idx").on(t.userId), uniqueIndex("reservations_code_uq").on(t.code)],
);

/** A business sponsoring a place in the game ("Presented by …"), set by an admin for a period. */
export const venueSponsors = pgTable("venue_sponsors", {
  venue: text("venue").primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tagline: text("tagline").notNull().default(""),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/** Real job vacancies posted by verified businesses. */
export const vacancies = pgTable(
  "vacancies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // full_time | part_time | gig | apprenticeship
    kind: text("kind").notNull(),
    pay: text("pay").notNull().default(""),
    area: text("area").notNull(),
    description: text("description").notNull(),
    wantsCertificate: boolean("wants_certificate").notNull().default(false),
    // open | closed
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("vacancies_status_idx").on(t.status), index("vacancies_business_idx").on(t.businessId)],
);

/** Applications to a vacancy: a message and the contact the applicant chose to share. */
export const jobApplications = pgTable(
  "job_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    contact: text("contact").notNull(),
    // new | shortlisted | declined
    status: text("status").notNull().default("new"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("job_applications_vacancy_user_uq").on(t.vacancyId, t.userId)],
);

/** The hustle board (see @hc/shared hustle.ts): players hire players. The fee is held from the poster when the job
 * goes up (ledger "hustle_escrow"), paid to the worker when it's confirmed or on its own a day after it's marked
 * done ("hustle_pay"), or returned ("hustle_refund"). */
export const hustleJobs = pgTable(
  "hustle_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    posterId: uuid("poster_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    details: text("details").notNull().default(""),
    fee: integer("fee").notNull(),
    place: text("place"),
    // open | taken | done | paid | cancelled | disputed | removed
    status: text("status").notNull().default("open"),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("hustle_jobs_status_idx").on(t.status, t.createdAt), index("hustle_jobs_poster_idx").on(t.posterId), index("hustle_jobs_worker_idx").on(t.workerId)],
);

/** One report per player per job; enough of them hide the job until an admin looks. */
export const hustleReports = pgTable(
  "hustle_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => hustleJobs.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("hustle_reports_job_reporter_uq").on(t.jobId, t.reporterId)],
);

/** Beta feedback from inside the game ("Report a problem"), and errors caught in players' browsers (kind "error",
 * sent automatically). Context: where they were, the device, the build and recent errors. */
export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    // bug | idea | other | error
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    context: jsonb("context").notNull().default({}),
    // For errors: the same error from the same player is counted, not stored again.
    fingerprint: text("fingerprint"),
    count: integer("count").notNull().default(1),
    // new | seen | fixed
    status: text("status").notNull().default("new"),
    createdAt: createdAt(),
    lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("feedback_status_idx").on(t.status, t.createdAt), uniqueIndex("feedback_error_uq").on(t.userId, t.fingerprint)],
);
