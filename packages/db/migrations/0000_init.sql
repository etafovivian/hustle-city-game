CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason_code" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_members" (
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_members_business_id_user_id_pk" PRIMARY KEY("business_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"service_area" text NOT NULL,
	"pickup_address" text,
	"description" text DEFAULT '' NOT NULL,
	"template_key" text DEFAULT 'free_shop' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_mock" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_kind_valid" CHECK ("businesses"."kind" in ('retail','artisan','office'))
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"kind" text NOT NULL,
	"reference" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_ledger_amount_nonzero" CHECK ("game_ledger_entries"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_kobo" bigint NOT NULL,
	"stock_status" text DEFAULT 'in_stock' NOT NULL,
	"photo_url" text,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_nonneg" CHECK ("products"."price_kobo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"nickname_hidden" boolean DEFAULT false NOT NULL,
	"avatar" jsonb NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"coin_balance" bigint DEFAULT 0 NOT NULL,
	"intro_claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_coin_balance_nonneg" CHECK ("profiles"."coin_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quest_progress" (
	"user_id" uuid NOT NULL,
	"day" text NOT NULL,
	"quest_key" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"seen_keys" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"claimed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_progress_user_id_day_quest_key_pk" PRIMARY KEY("user_id","day","quest_key")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sim_inventory" (
	"shop_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"price" integer NOT NULL,
	CONSTRAINT "sim_inventory_shop_id_item_key_pk" PRIMARY KEY("shop_id","item_key"),
	CONSTRAINT "sim_inventory_qty_nonneg" CHECK ("sim_inventory"."quantity" >= 0),
	CONSTRAINT "sim_inventory_price_pos" CHECK ("sim_inventory"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "sim_orders" (
	"shop_id" uuid NOT NULL,
	"slot" bigint NOT NULL,
	"item_key" text NOT NULL,
	"units" integer NOT NULL,
	"offer" integer NOT NULL,
	"fulfilled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sim_orders_shop_id_slot_pk" PRIMARY KEY("shop_id","slot")
);
--> statement-breakpoint
CREATE TABLE "sim_shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"settled_step" bigint NOT NULL,
	"uncollected" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"roles" text[] DEFAULT ARRAY['player']::text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_ledger_entries" ADD CONSTRAINT "game_ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sim_inventory" ADD CONSTRAINT "sim_inventory_shop_id_sim_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."sim_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sim_orders" ADD CONSTRAINT "sim_orders_shop_id_sim_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."sim_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sim_shops" ADD CONSTRAINT "sim_shops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "businesses_status_category_idx" ON "businesses" USING btree ("status","category");--> statement-breakpoint
CREATE UNIQUE INDEX "game_ledger_user_ref_uq" ON "game_ledger_entries" USING btree ("user_id","reference");--> statement-breakpoint
CREATE INDEX "game_ledger_kind_created_idx" ON "game_ledger_entries" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "products_business_idx" ON "products" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_nickname_lower_uq" ON "profiles" USING btree (lower("nickname"));--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sim_shops_owner_uq" ON "sim_shops" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));