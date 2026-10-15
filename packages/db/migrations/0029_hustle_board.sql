CREATE TABLE "hustle_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poster_id" uuid NOT NULL,
	"worker_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"fee" integer NOT NULL,
	"place" text,
	"status" text DEFAULT 'open' NOT NULL,
	"taken_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hustle_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hustle_jobs" ADD CONSTRAINT "hustle_jobs_poster_id_users_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hustle_jobs" ADD CONSTRAINT "hustle_jobs_worker_id_users_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hustle_reports" ADD CONSTRAINT "hustle_reports_job_id_hustle_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."hustle_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hustle_reports" ADD CONSTRAINT "hustle_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hustle_jobs_status_idx" ON "hustle_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "hustle_jobs_poster_idx" ON "hustle_jobs" USING btree ("poster_id");--> statement-breakpoint
CREATE INDEX "hustle_jobs_worker_idx" ON "hustle_jobs" USING btree ("worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hustle_reports_job_reporter_uq" ON "hustle_reports" USING btree ("job_id","reporter_id");