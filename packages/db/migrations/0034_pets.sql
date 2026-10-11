CREATE TABLE "player_pets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"happiness" integer DEFAULT 70 NOT NULL,
	"happy_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cared" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"adopted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_pets" ADD CONSTRAINT "player_pets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;