import { pgTable, uuid, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { studentProfiles } from "./auth";

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentProfileId: uuid("student_profile_id")
    .references(() => studentProfiles.id)
    .notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // 'AI_CHAT', 'QUESTION_EXPLAIN', etc.
  tokenCount: integer("token_count"), // Track token usages
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentActivityLogs = pgTable("student_activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentProfileId: uuid("student_profile_id")
    .references(() => studentProfiles.id)
    .notNull(),
  activityType: varchar("activity_type", { length: 100 }).notNull(), // 'STARTED_PRACTICE', 'COMPLETED_TEST', etc.
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
