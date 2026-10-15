CREATE TABLE "home_items" (
	"user_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_items_user_id_item_key_pk" PRIMARY KEY("user_id","item_key")
);
--> statement-breakpoint
CREATE TABLE "player_plots" (
	"plot_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"design" text,
	"is_home" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "home_items" ADD CONSTRAINT "home_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_plots" ADD CONSTRAINT "player_plots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_plots_user_idx" ON "player_plots" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "player_plots" ("plot_id", "user_id", "design", "is_home", "created_at") SELECT "plot_id", "user_id", "design", true, "created_at" FROM "player_homes" ON CONFLICT DO NOTHING;
