ALTER TABLE "test_answers" DROP CONSTRAINT "test_answers_test_attempt_id_test_attempts_id_fk";
--> statement-breakpoint
ALTER TABLE "test_attempts" DROP CONSTRAINT "test_attempts_test_id_tests_id_fk";
--> statement-breakpoint
ALTER TABLE "test_questions" DROP CONSTRAINT "test_questions_test_id_tests_id_fk";
--> statement-breakpoint
ALTER TABLE "test_answers" ALTER COLUMN "selected_answer" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "test_answers" ALTER COLUMN "is_correct" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "test_answers" ALTER COLUMN "time_spent_seconds" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "test_answers" ALTER COLUMN "time_spent_seconds" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "test_attempts" ALTER COLUMN "exam_attempt_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "test_answers" ADD COLUMN "marked_for_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD COLUMN "paused_at" timestamp;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD COLUMN "total_paused_time_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD COLUMN "randomized_question_order" jsonb;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD COLUMN "randomized_option_ordering" jsonb;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "code" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "curriculum_version_id" uuid;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "curriculum_node_id" uuid;--> statement-breakpoint
ALTER TABLE "test_answers" ADD CONSTRAINT "test_answers_test_attempt_id_test_attempts_id_fk" FOREIGN KEY ("test_attempt_id") REFERENCES "public"."test_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_curriculum_version_id_curriculum_versions_id_fk" FOREIGN KEY ("curriculum_version_id") REFERENCES "public"."curriculum_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_curriculum_node_id_curriculum_nodes_id_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "public"."curriculum_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_code_unique" UNIQUE("code");