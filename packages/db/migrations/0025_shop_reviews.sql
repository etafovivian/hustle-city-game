CREATE TABLE "shop_reviews" (
	"claim_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_reviews_rating" CHECK ("shop_reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_claim_id_deal_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."deal_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_reviews_business_idx" ON "shop_reviews" USING btree ("business_id");