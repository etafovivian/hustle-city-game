CREATE TABLE "business_stats" (
	"business_id" uuid NOT NULL,
	"day" text NOT NULL,
	"kind" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "business_stats_business_id_day_kind_pk" PRIMARY KEY("business_id","day","kind")
);
--> statement-breakpoint
ALTER TABLE "business_stats" ADD CONSTRAINT "business_stats_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;