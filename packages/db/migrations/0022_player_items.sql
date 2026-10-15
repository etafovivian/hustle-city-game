CREATE TABLE "player_items" (
	"user_id" uuid NOT NULL,
	"item" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_items_user_id_item_pk" PRIMARY KEY("user_id","item")
);
--> statement-breakpoint
ALTER TABLE "player_items" ADD CONSTRAINT "player_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;