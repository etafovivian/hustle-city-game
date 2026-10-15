CREATE TABLE "player_homes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"plot_id" text NOT NULL,
	"design" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_jobs" (
	"user_id" uuid NOT NULL,
	"venue" text NOT NULL,
	"shifts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_jobs_user_id_venue_pk" PRIMARY KEY("user_id","venue")
);
--> statement-breakpoint
CREATE TABLE "player_vehicles" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_vehicles_user_id_kind_pk" PRIMARY KEY("user_id","kind")
);
--> statement-breakpoint
ALTER TABLE "player_homes" ADD CONSTRAINT "player_homes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_jobs" ADD CONSTRAINT "player_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_vehicles" ADD CONSTRAINT "player_vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_homes_plot_uq" ON "player_homes" USING btree ("plot_id");