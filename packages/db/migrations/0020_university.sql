CREATE TABLE "uni_courses" (
	"user_id" uuid NOT NULL,
	"course" text NOT NULL,
	"lectures" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"passed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uni_courses_user_id_course_pk" PRIMARY KEY("user_id","course")
);
--> statement-breakpoint
CREATE TABLE "uni_enrolments" (
	"user_id" uuid NOT NULL,
	"programme" text NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"graduated_at" timestamp with time zone,
	CONSTRAINT "uni_enrolments_user_id_programme_pk" PRIMARY KEY("user_id","programme")
);
--> statement-breakpoint
CREATE TABLE "uni_lectures" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"course" text NOT NULL,
	"day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "uni_courses" ADD CONSTRAINT "uni_courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uni_enrolments" ADD CONSTRAINT "uni_enrolments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uni_lectures" ADD CONSTRAINT "uni_lectures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uni_lectures_user_day" ON "uni_lectures" USING btree ("user_id","day");