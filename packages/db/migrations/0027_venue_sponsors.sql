CREATE TABLE "venue_sponsors" (
	"venue" text PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_sponsors" ADD CONSTRAINT "venue_sponsors_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;