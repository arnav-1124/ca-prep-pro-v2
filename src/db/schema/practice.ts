import { pgTable, uuid, boolean, integer, timestamp, text, varchar, uniqueIndex, index } from "drizzle-orm/pg-core";
import { studentProfiles } from "./auth";
import { academicLevels, subjects, curriculumNodes, examAttempts, curriculumVersions } from "./academics";
import { questions, questionVersions } from "./questions";

export const practiceSessions = pgTable(
  "practice_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .references(() => studentProfiles.id)
      .notNull(),
    academicLevelId: uuid("academic_level_id")
      .references(() => academicLevels.id)
      .notNull(),
    curriculumVersionId: uuid("curriculum_version_id")
      .references(() => curriculumVersions.id),
    subjectId: uuid("subject_id").references(() => subjects.id),
    curriculumNodeId: uuid("curriculum_node_id").references(() => curriculumNodes.id), // Nullable
    examAttemptId: uuid("exam_attempt_id")
      .references(() => examAttempts.id), // Nullable
    status: varchar("status", { length: 50 }).default("ACTIVE").notNull(), // 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'
    practiceMode: varchar("practice_mode", { length: 50 }).default("QUESTION").notNull(), // 'QUESTION', 'CASE_STUDY'
    difficulty: varchar("difficulty", { length: 50 }), // 'ANY', 'EASY', 'MEDIUM', 'HARD'
    questionType: varchar("question_type", { length: 50 }), // 'MCQ', 'CASE_STUDY'
    questionCount: integer("question_count"),
    sessionSeed: integer("session_seed").default(12345).notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("practice_sessions_student_idx").on(table.studentProfileId),
    index("practice_sessions_level_idx").on(table.academicLevelId),
    index("practice_sessions_version_idx").on(table.curriculumVersionId),
    index("practice_sessions_subject_idx").on(table.subjectId),
    index("practice_sessions_node_idx").on(table.curriculumNodeId),
    index("practice_sessions_status_idx").on(table.status),
    index("practice_sessions_created_at_idx").on(table.createdAt),
  ]
);

export const practiceSessionQuestions = pgTable(
  "practice_session_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceSessionId: uuid("practice_session_id")
      .references(() => practiceSessions.id, { onDelete: "cascade" })
      .notNull(),
    questionId: uuid("question_id")
      .references(() => questions.id)
      .notNull(),
    questionVersionId: uuid("question_version_id")
      .references(() => questionVersions.id)
      .notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    deliveredAt: timestamp("delivered_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("practice_session_questions_session_question_unique_idx").on(
      table.practiceSessionId,
      table.questionId
    ),
    uniqueIndex("practice_session_questions_session_seq_unique_idx").on(
      table.practiceSessionId,
      table.sequenceNumber
    ),
    index("practice_session_questions_session_idx").on(table.practiceSessionId),
    index("practice_session_questions_version_idx").on(table.questionVersionId),
    index("practice_session_questions_question_idx").on(table.questionId),
    index("practice_session_questions_delivered_at_idx").on(table.deliveredAt),
  ]
);

export const practiceAttempts = pgTable(
  "practice_attempts",
  {
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
  },
  (table) => [
    index("practice_attempts_session_idx").on(table.practiceSessionId),
    index("practice_attempts_version_idx").on(table.questionVersionId),
    index("practice_attempts_created_at_idx").on(table.createdAt),
  ]
);

