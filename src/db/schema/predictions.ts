import { pgTable, uuid, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { academicLevels, examAttempts } from "./academics";
import { questions } from "./questions";

export const predictions = pgTable("predictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id")
    .references(() => questions.id)
    .notNull(),
  academicLevelId: uuid("academic_level_id")
    .references(() => academicLevels.id)
    .notNull(),
  examAttemptId: uuid("exam_attempt_id")
    .references(() => examAttempts.id)
    .notNull(),
  predictedAt: timestamp("predicted_at").defaultNow().notNull(),
  probability: numeric("probability", { precision: 5, scale: 2 }).notNull(), // Confidence percentage e.g. 78.50
  evidence: jsonb("evidence"), // Context/data that informed the prediction
  modelMetadata: jsonb("model_metadata"), // Provider, model identifier, etc.
  versionNumber: integer("version_number").notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  isCorrect: boolean("is_correct"), // Filled after the actual CA exam occurs
});
