CREATE TABLE "shop_decor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"price_paid" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_decor_rotation_valid" CHECK ("shop_decor"."rotation" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "shop_decor" ADD CONSTRAINT "shop_decor_shop_id_sim_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."sim_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_decor_shop_idx" ON "shop_decor" USING btree ("shop_id");