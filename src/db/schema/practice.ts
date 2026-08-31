import { pgTable, uuid, boolean, integer, timestamp, text, varchar } from "drizzle-orm/pg-core";
import { studentProfiles } from "./auth";
import { academicLevels, subjects, curriculumNodes, examAttempts } from "./academics";
import { questionVersions } from "./questions";

export const practiceSessions = pgTable("practice_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentProfileId: uuid("student_profile_id")
    .references(() => studentProfiles.id)
    .notNull(),
  academicLevelId: uuid("academic_level_id")
    .references(() => academicLevels.id)
    .notNull(),
  subjectId: uuid("subject_id").references(() => subjects.id),
  curriculumNodeId: uuid("curriculum_node_id").references(() => curriculumNodes.id), // Nullable
  examAttemptId: uuid("exam_attempt_id")
    .references(() => examAttempts.id), // Nullable
  status: varchar("status", { length: 50 }).default("IN_PROGRESS").notNull(), // 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'
  practiceMode: varchar("practice_mode", { length: 50 }).default("QUESTION").notNull(), // 'QUESTION', 'CASE_STUDY'
  difficulty: varchar("difficulty", { length: 50 }), // 'ANY', 'EASY', 'MEDIUM', 'HARD'
  questionType: varchar("question_type", { length: 50 }), // 'MCQ', 'CASE_STUDY'
  questionCount: integer("question_count"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const practiceAttempts = pgTable("practice_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceSessionId: uuid("practice_session_id")
    .references(() => practiceSessions.id)
    .notNull(),
  questionVersionId: uuid("question_version_id")
    .references(() => questionVersions.id)
    .notNull(),
  selectedAnswer: text("selected_answer").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  timeSpentSeconds: integer("time_spent_seconds"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
