CREATE TABLE "partner_bonds" (
	"user_id" uuid NOT NULL,
	"npc" text NOT NULL,
	"stage" text DEFAULT 'met' NOT NULL,
	"closeness" integer DEFAULT 0 NOT NULL,
	"chats" integer DEFAULT 0 NOT NULL,
	"chat_day" text,
	"chats_on_day" integer DEFAULT 0 NOT NULL,
	"gift_day" text,
	"date_at" timestamp with time zone,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_bonds_user_id_npc_pk" PRIMARY KEY("user_id","npc")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "partner_pref" text;--> statement-breakpoint
ALTER TABLE "partner_bonds" ADD CONSTRAINT "partner_bonds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;