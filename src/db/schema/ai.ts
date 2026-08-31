import { pgTable, uuid, varchar, timestamp, text } from "drizzle-orm/pg-core";
import { studentProfiles } from "./auth";
import { academicLevels, examAttempts, subjects, curriculumNodes } from "./academics";
import { questions, questionVersions } from "./questions";

export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentProfileId: uuid("student_profile_id")
    .references(() => studentProfiles.id)
    .notNull(),
  academicLevelId: uuid("academic_level_id").references(() => academicLevels.id),
  examAttemptId: uuid("exam_attempt_id").references(() => examAttempts.id),
  subjectId: uuid("subject_id").references(() => subjects.id),
  curriculumNodeId: uuid("curriculum_node_id").references(() => curriculumNodes.id), // Nullable
  questionId: uuid("question_id").references(() => questions.id), // Context for question doubt solving
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .references(() => aiConversations.id)
    .notNull(),
  role: varchar("role", { length: 50 }).notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiExplanations = pgTable("ai_explanations", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionVersionId: uuid("question_version_id")
    .references(() => questionVersions.id, { onDelete: "cascade" })
    .notNull()
    .unique(), // Enforce only one cache entry per question version
  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  explanation: text("explanation").notNull(),
  keyPoint: text("key_point").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentProfileId: uuid("student_profile_id")
    .references(() => studentProfiles.id, { onDelete: "cascade" })
    .notNull(),
  action: varchar("action", { length: 50 }).notNull(), // 'EXPLANATION'
  questionVersionId: uuid("question_version_id")
    .references(() => questionVersions.id, { onDelete: "set null" }),
  provider: varchar("provider", { length: 50 }),
  model: varchar("model", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
