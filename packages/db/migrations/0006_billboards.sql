CREATE TABLE "ad_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advertiser_id" uuid NOT NULL,
	"billboard_key" text NOT NULL,
	"headline" text NOT NULL,
	"link_url" text NOT NULL,
	"weeks" integer NOT NULL,
	"price_kobo" bigint NOT NULL,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"payment_reference" text,
	"review_note" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_campaigns_weeks_range" CHECK ("ad_campaigns"."weeks" between 1 and 4),
	CONSTRAINT "ad_campaigns_review_valid" CHECK ("ad_campaigns"."review_status" in ('pending','approved','rejected')),
	CONSTRAINT "ad_campaigns_payment_valid" CHECK ("ad_campaigns"."payment_status" in ('unpaid','paid'))
);
--> statement-breakpoint
CREATE TABLE "ad_creatives" (
	"campaign_id" uuid PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_stats" (
	"campaign_id" uuid NOT NULL,
	"day" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ad_stats_campaign_id_day_pk" PRIMARY KEY("campaign_id","day")
);
--> statement-breakpoint
CREATE TABLE "billboards" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" text DEFAULT 'standard' NOT NULL,
	"price_kobo_per_week" bigint NOT NULL,
	"capacity" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_advertiser_id_users_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_billboard_key_billboards_key_fk" FOREIGN KEY ("billboard_key") REFERENCES "public"."billboards"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_stats" ADD CONSTRAINT "ad_stats_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_campaigns_board_live_idx" ON "ad_campaigns" USING btree ("billboard_key","ends_at");--> statement-breakpoint
CREATE INDEX "ad_campaigns_advertiser_idx" ON "ad_campaigns" USING btree ("advertiser_id","created_at");