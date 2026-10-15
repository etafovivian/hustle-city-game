CREATE TABLE "certificate_revocations" (
	"certificate_id" uuid PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"holder_name" text NOT NULL,
	"course_title" text NOT NULL,
	"provider" text NOT NULL,
	"kind" text DEFAULT 'virtual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_kind_valid" CHECK ("certificates"."kind" in ('virtual','physical'))
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"quiz_size" integer DEFAULT 5 NOT NULL,
	"pass_percent" integer DEFAULT 70 NOT NULL,
	CONSTRAINT "course_modules_pass_range" CHECK ("course_modules"."pass_percent" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"level" text DEFAULT 'beginner' NOT NULL,
	"provider" text DEFAULT 'lampnet' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reward_coins" integer DEFAULT 500 NOT NULL,
	"reward_xp" integer DEFAULT 100 NOT NULL,
	"physical_cert_kobo" bigint DEFAULT 500000 NOT NULL,
	"training_fee_kobo" bigint,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_status_valid" CHECK ("courses"."status" in ('draft','published')),
	CONSTRAINT "courses_provider_valid" CHECK ("courses"."provider" in ('lampnet','akuretechhub'))
);
--> statement-breakpoint
CREATE TABLE "enrolments" (
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "enrolments_user_id_course_id_pk" PRIMARY KEY("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"last_beat_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "lesson_progress_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'video' NOT NULL,
	"youtube_id" text,
	"body" text DEFAULT '' NOT NULL,
	"min_seconds" integer DEFAULT 60 NOT NULL,
	CONSTRAINT "lessons_min_seconds_nonneg" CHECK ("lessons"."min_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"question_ids" jsonb NOT NULL,
	"answers" jsonb,
	"percent" integer,
	"passed" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"answer" integer NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certificate_revocations" ADD CONSTRAINT "certificate_revocations_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_revocations" ADD CONSTRAINT "certificate_revocations_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_number_uq" ON "certificates" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_course_kind_uq" ON "certificates" USING btree ("user_id","course_id","kind");--> statement-breakpoint
CREATE INDEX "course_modules_course_idx" ON "course_modules" USING btree ("course_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_slug_uq" ON "courses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lessons_module_idx" ON "lessons" USING btree ("module_id","position");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_module_idx" ON "quiz_attempts" USING btree ("user_id","module_id","created_at");--> statement-breakpoint
CREATE INDEX "quiz_questions_module_idx" ON "quiz_questions" USING btree ("module_id");--> statement-breakpoint
-- Certificates and revocations are permanent records (block_mutation() comes from 0005).
CREATE TRIGGER certificates_no_update_delete
  BEFORE UPDATE OR DELETE ON certificates
  FOR EACH ROW EXECUTE FUNCTION block_mutation();
--> statement-breakpoint
CREATE TRIGGER certificate_revocations_no_update_delete
  BEFORE UPDATE OR DELETE ON certificate_revocations
  FOR EACH ROW EXECUTE FUNCTION block_mutation();
