CREATE TABLE "case_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academic_level_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"scenario_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "case_study_id" uuid;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "practice_mode" varchar(50) DEFAULT 'QUESTION' NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "difficulty" varchar(50);--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "question_type" varchar(50);--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "question_count" integer;--> statement-breakpoint
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_academic_level_id_academic_levels_id_fk" FOREIGN KEY ("academic_level_id") REFERENCES "public"."academic_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_case_study_id_case_studies_id_fk" FOREIGN KEY ("case_study_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;