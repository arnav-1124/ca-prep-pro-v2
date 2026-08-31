import { pgTable, uuid, varchar, integer, boolean, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { studentProfiles } from "./auth";
import { academicLevels, examAttempts, curriculumVersions, subjects, curriculumNodes } from "./academics";
import { questions, questionVersions } from "./questions";

export const tests = pgTable("tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // Unique identifier for idempotency
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  academicLevelId: uuid("academic_level_id")
    .references(() => academicLevels.id)
    .notNull(),
  curriculumVersionId: uuid("curriculum_version_id")
    .references(() => curriculumVersions.id),
  subjectId: uuid("subject_id")
    .references(() => subjects.id), // Nullable for level-wide mixed tests
  curriculumNodeId: uuid("curriculum_node_id")
    .references(() => curriculumNodes.id), // Nullable for subject-wide mixed tests
  examAttemptId: uuid("exam_attempt_id").references(() => examAttempts.id),
  durationMinutes: integer("duration_minutes").notNull(),
  totalMarks: integer("total_marks").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const testQuestions = pgTable("test_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  testId: uuid("test_id")
    .references(() => tests.id, { onDelete: "cascade" })
    .notNull(),
  questionId: uuid("question_id")
    .references(() => questions.id)
    .notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const testAttempts = pgTable("test_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  testId: uuid("test_id")
    .references(() => tests.id, { onDelete: "cascade" })
    .notNull(),
  studentProfileId: uuid("student_profile_id")
    .references(() => studentProfiles.id)
    .notNull(),
  examAttemptId: uuid("exam_attempt_id")
    .references(() => examAttempts.id), // Nullable so students can take tests before setting attempts
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  pausedAt: timestamp("paused_at"), // Track pauses
  totalPausedTimeSeconds: integer("total_paused_time_seconds").default(0).notNull(),
  randomizedQuestionOrder: jsonb("randomized_question_order"), // Array of question IDs
  randomizedOptionOrdering: jsonb("randomized_option_ordering"), // Map of questionVersionId -> randomized option array
  score: integer("score"), // Accumulated actual marks obtained
  status: varchar("status", { length: 50 }).default("STARTED").notNull(), // 'STARTED', 'PAUSED', 'COMPLETED'
});

export const testAnswers = pgTable("test_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  testAttemptId: uuid("test_attempt_id")
    .references(() => testAttempts.id, { onDelete: "cascade" })
    .notNull(),
  questionVersionId: uuid("question_version_id")
    .references(() => questionVersions.id)
    .notNull(),
  selectedAnswer: text("selected_answer"), // Nullable to handle unanswered status
  isCorrect: boolean("is_correct"), // Nullable until submission/grading
  markedForReview: boolean("marked_for_review").default(false).notNull(),
  timeSpentSeconds: integer("time_spent_seconds").default(0).notNull(),
});
