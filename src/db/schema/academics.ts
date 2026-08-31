import { pgTable, uuid, varchar, integer, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { studentProfiles } from "./auth";

export const academicLevels = pgTable("academic_levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // 'FOUNDATION', 'INTERMEDIATE', 'FINAL'
  name: varchar("name", { length: 255 }).notNull(),
});

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    academicLevelId: uuid("academic_level_id")
      .references(() => academicLevels.id)
      .notNull(),
    code: varchar("code", { length: 50 }).notNull(), // 'PAPER_1', etc.
    name: varchar("name", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    index("subjects_academic_level_id_idx").on(table.academicLevelId),
    uniqueIndex("subjects_level_code_unique_idx").on(table.academicLevelId, table.code),
  ]
);

export const curriculumVersions = pgTable(
  "curriculum_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    academicLevelId: uuid("academic_level_id")
      .references(() => academicLevels.id)
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    applicableFrom: timestamp("applicable_from").notNull(),
    applicableTo: timestamp("applicable_to"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("curriculum_versions_single_active_per_level_idx")
      .on(table.academicLevelId)
      .where(sql`is_active = true`),
    index("curriculum_versions_level_idx").on(table.academicLevelId),
  ]
);

export const curriculumNodes = pgTable(
  "curriculum_nodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    curriculumVersionId: uuid("curriculum_version_id")
      .references(() => curriculumVersions.id, { onDelete: "cascade" })
      .notNull(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentId: uuid("parent_id").references((): any => curriculumNodes.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .references(() => subjects.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 50 }).notNull(), // 'MODULE', 'SECTION', 'CHAPTER', 'UNIT', 'TOPIC'
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 100 }).notNull().unique(), // Enforces unique path/node keys for idempotency
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("curriculum_nodes_version_id_idx").on(table.curriculumVersionId),
    index("curriculum_nodes_subject_id_idx").on(table.subjectId),
    index("curriculum_nodes_parent_id_idx").on(table.parentId),
  ]
);

export const examAttempts = pgTable("exam_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  academicLevelId: uuid("academic_level_id")
    .references(() => academicLevels.id)
    .notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 5 for May, 11 for Nov
  name: varchar("name", { length: 255 }).notNull(), // e.g. "May 2027"
  targetDate: timestamp("target_date"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const studentAttempts = pgTable(
  "student_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .references(() => studentProfiles.id)
      .notNull(),
    academicLevelId: uuid("academic_level_id")
      .references(() => academicLevels.id)
      .notNull(),
    examAttemptId: uuid("exam_attempt_id")
      .references(() => examAttempts.id), // Nullable
    targetDate: timestamp("target_date"), // Nullable
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("student_attempts_profile_active_idx").on(table.studentProfileId, table.isActive),
    index("student_attempts_level_id_idx").on(table.academicLevelId),
  ]
);

