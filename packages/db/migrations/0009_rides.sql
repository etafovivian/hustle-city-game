CREATE TABLE "rides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"units" integer NOT NULL,
	"fare" integer NOT NULL,
	"stop" boolean DEFAULT false NOT NULL,
	"stop_choice" text,
	"stop_cost" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rides_user_created_idx" ON "rides" USING btree ("user_id","created_at");