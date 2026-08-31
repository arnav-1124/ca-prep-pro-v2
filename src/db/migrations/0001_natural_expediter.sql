ALTER TABLE "student_attempts" ALTER COLUMN "exam_attempt_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "student_attempts" ADD COLUMN "academic_level_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "student_attempts" ADD COLUMN "target_date" timestamp;--> statement-breakpoint
ALTER TABLE "student_attempts" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "student_attempts" ADD CONSTRAINT "student_attempts_academic_level_id_academic_levels_id_fk" FOREIGN KEY ("academic_level_id") REFERENCES "public"."academic_levels"("id") ON DELETE no action ON UPDATE no action;