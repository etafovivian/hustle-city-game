CREATE TABLE "land_interest" (
	"user_id" uuid NOT NULL,
	"plot_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "land_interest_user_id_plot_id_pk" PRIMARY KEY("user_id","plot_id")
);
--> statement-breakpoint
ALTER TABLE "land_interest" ADD CONSTRAINT "land_interest_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;