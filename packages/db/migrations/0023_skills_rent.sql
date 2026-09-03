CREATE TABLE "player_skills" (
	"user_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "player_skills_user_id_skill_pk" PRIMARY KEY("user_id","skill")
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"unit" text NOT NULL,
	"area" text NOT NULL,
	"plot_id" text NOT NULL,
	"weekly" integer NOT NULL,
	"caution" integer NOT NULL,
	"paid_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_plots" ADD COLUMN "let_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "player_skills" ADD CONSTRAINT "player_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;