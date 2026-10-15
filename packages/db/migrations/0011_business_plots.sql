CREATE TABLE "business_plots" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"plot_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_plots" ADD CONSTRAINT "business_plots_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_plots_plot_uq" ON "business_plots" USING btree ("plot_id");