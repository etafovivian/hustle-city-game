CREATE TABLE "player_days" (
	"user_id" uuid NOT NULL,
	"day" text NOT NULL,
	CONSTRAINT "player_days_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "tester_rewards" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tier" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid" integer DEFAULT 0 NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "player_days" ADD CONSTRAINT "player_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tester_rewards" ADD CONSTRAINT "tester_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Days already played before this table (coins earned or spent, or quest progress), in Lagos days.
INSERT INTO "player_days" ("user_id", "day")
SELECT DISTINCT user_id, to_char((created_at AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') FROM "game_ledger_entries" WHERE kind NOT IN ('signup_grant', 'admin_adjustment')
UNION
SELECT DISTINCT user_id, day FROM "quest_progress" WHERE day ~ '^\d{4}-\d{2}-\d{2}$'
ON CONFLICT DO NOTHING;
