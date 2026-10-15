CREATE TABLE "player_needs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"needs" jsonb NOT NULL,
	"free_at" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_needs" ADD CONSTRAINT "player_needs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;