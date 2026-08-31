CREATE TABLE "play_night_rsvps" (
	"event" text NOT NULL,
	"day" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "play_night_rsvps_event_day_user_id_pk" PRIMARY KEY("event","day","user_id")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"invitee_id" uuid PRIMARY KEY NOT NULL,
	"inviter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rewarded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "play_night_rsvps" ADD CONSTRAINT "play_night_rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referrals_inviter" ON "referrals" USING btree ("inviter_id");