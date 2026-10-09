CREATE TABLE "house_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"plot_id" text NOT NULL,
	"size" text NOT NULL,
	"day" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_guests" (
	"party_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "party_guests_party_id_user_id_pk" PRIMARY KEY("party_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "house_parties" ADD CONSTRAINT "house_parties_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_guests" ADD CONSTRAINT "party_guests_party_id_house_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."house_parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_guests" ADD CONSTRAINT "party_guests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "house_parties_host_day" ON "house_parties" USING btree ("host_id","day");--> statement-breakpoint
CREATE INDEX "house_parties_ends" ON "house_parties" USING btree ("ends_at");