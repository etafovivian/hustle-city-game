CREATE TABLE "deal_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"title" text NOT NULL,
	"terms" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"max_claims" integer NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_status_valid" CHECK ("deals"."status" in ('pending_review','live','rejected','ended'))
);
--> statement-breakpoint
ALTER TABLE "deal_claims" ADD CONSTRAINT "deal_claims_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_claims" ADD CONSTRAINT "deal_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_claims_code_uq" ON "deal_claims" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_claims_deal_user_uq" ON "deal_claims" USING btree ("deal_id","user_id");--> statement-breakpoint
CREATE INDEX "deals_business_idx" ON "deals" USING btree ("business_id");