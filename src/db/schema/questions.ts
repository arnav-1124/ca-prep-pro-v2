import { pgTable, uuid, varchar, integer, boolean, timestamp, jsonb, text, index } from "drizzle-orm/pg-core";
import { academicLevels, subjects, curriculumVersions, curriculumNodes } from "./academics";

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchName: varchar("batch_name", { length: 255 }).notNull(),
    schemaVersion: varchar("schema_version", { length: 50 }).default("1.0").notNull(), // e.g. "1.0"
    academicLevelId: uuid("academic_level_id")
      .references(() => academicLevels.id)
      .notNull(),
    curriculumVersionId: uuid("curriculum_version_id")
      .references(() => curriculumVersions.id)
      .notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id), // Default subject if batch-scoped
    sourceType: varchar("source_type", { length: 50 }).default("STUDY_MATERIAL").notNull(), // 'STUDY_MATERIAL', 'RTP', 'MTP', 'PYQ', 'OTHER_OFFICIAL', 'AI_GENERATED'
    sourceTitle: varchar("source_title", { length: 255 }),
    sourceYear: integer("source_year"),
    sourceMonth: integer("source_month"), // 5 for May, 11 for Nov
    status: varchar("status", { length: 50 }).default("PENDING_REVIEW").notNull(),
    // 'PROCESSING', 'PENDING_REVIEW', 'PARTIALLY_APPROVED', 'COMPLETED', 'CANCELLED', 'FAILED'
    totalQuestions: integer("total_questions").default(0).notNull(),
    validQuestionsCount: integer("valid_questions_count").default(0).notNull(),
    invalidQuestionsCount: integer("invalid_questions_count").default(0).notNull(),
    duplicateCandidatesCount: integer("duplicate_candidates_count").default(0).notNull(),
    approvedCount: integer("approved_count").default(0).notNull(),
    rejectedCount: integer("rejected_count").default(0).notNull(),
    pendingReviewCount: integer("pending_review_count").default(0).notNull(),
    publishedCount: integer("published_count").default(0).notNull(),
    createdByUserEmail: varchar("created_by_user_email", { length: 255 }),
    metadata: jsonb("metadata"),
    importedAt: timestamp("imported_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("import_batches_level_idx").on(table.academicLevelId),
    index("import_batches_version_idx").on(table.curriculumVersionId),
    index("import_batches_subject_idx").on(table.subjectId),
    index("import_batches_status_idx").on(table.status),
    index("import_batches_created_at_idx").on(table.createdAt),
  ]
);

export const questionSources = pgTable(
  "question_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: varchar("source_type", { length: 50 }).notNull(), // 'STUDY_MATERIAL', 'RTP', 'MTP', 'PYQ', 'OTHER_OFFICIAL', 'AI_GENERATED'
    sourceTitle: varchar("source_title", { length: 255 }).notNull(),
    sourceYear: integer("source_year"),
    sourceMonth: integer("source_month"), // 5 for May, 11 for Nov
    paperNumber: varchar("paper_number", { length: 50 }),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("question_sources_type_idx").on(table.sourceType),
    index("question_sources_batch_idx").on(table.importBatchId),
  ]
);

export const caseStudies = pgTable(
  "case_studies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    academicLevelId: uuid("academic_level_id")
      .references(() => academicLevels.id)
      .notNull(),
    subjectId: uuid("subject_id")
      .references(() => subjects.id)
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    scenarioText: text("scenario_text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("case_studies_level_id_idx").on(table.academicLevelId),
    index("case_studies_subject_id_idx").on(table.subjectId),
  ]
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    academicLevelId: uuid("academic_level_id")
      .references(() => academicLevels.id)
      .notNull(),
    subjectId: uuid("subject_id")
      .references(() => subjects.id)
      .notNull(),
    curriculumNodeId: uuid("curriculum_node_id")
      .references(() => curriculumNodes.id)
      .notNull(),
    caseStudyId: uuid("case_study_id").references(() => caseStudies.id, { onDelete: "cascade" }),
    difficulty: varchar("difficulty", { length: 50 }).notNull(), // 'EASY', 'MEDIUM', 'HARD'
    questionType: varchar("question_type", { length: 50 }).notNull(), // 'MCQ', 'CASE_STUDY'
    isAiGenerated: boolean("is_ai_generated").default(false).notNull(),
    aiMetadata: jsonb("ai_metadata"), // Stores prompts, seed contexts, etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("questions_academic_level_id_idx").on(table.academicLevelId),
    index("questions_subject_id_idx").on(table.subjectId),
    index("questions_curriculum_node_id_idx").on(table.curriculumNodeId),
    index("questions_case_study_id_idx").on(table.caseStudyId),
    index("questions_difficulty_idx").on(table.difficulty),
    index("questions_question_type_idx").on(table.questionType),
  ]
);

export const questionVersions = pgTable(
  "question_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .references(() => questions.id)
      .notNull(),
    versionNumber: integer("version_number").notNull(),
    questionText: text("question_text").notNull(),
    correctAnswer: text("correct_answer").notNull(), // option letter 'A', 'B', etc.
    explanation: text("explanation"),
    isActive: boolean("is_active").default(true).notNull(),
    sourceId: uuid("source_id").references(() => questionSources.id),
    sourceMetadata: jsonb("source_metadata"), // e.g. page numbers, RTP chapter
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("question_versions_question_id_idx").on(table.questionId),
    index("question_versions_is_active_idx").on(table.isActive),
    index("question_versions_source_id_idx").on(table.sourceId),
  ]
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionVersionId: uuid("question_version_id")
      .references(() => questionVersions.id)
      .notNull(),
    optionLetter: varchar("option_letter", { length: 10 }).notNull(), // 'A', 'B', 'C', 'D'
    optionText: text("option_text").notNull(),
  },
  (table) => [
    index("question_options_version_id_idx").on(table.questionVersionId),
  ]
);

export const importedQuestions = pgTable(
  "imported_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .references(() => importBatches.id, { onDelete: "cascade" })
      .notNull(),
    questionIndex: integer("question_index").notNull(),

    // Raw and Working Payload
    rawPayload: jsonb("raw_payload").notNull(),
    editedPayload: jsonb("edited_payload"),

    // Fast indexed summary fields
    questionTextPreview: text("question_text_preview").notNull(),
    questionType: varchar("question_type", { length: 50 }).default("MCQ").notNull(),
    difficulty: varchar("difficulty", { length: 50 }).default("MEDIUM").notNull(),

    // Review Lifecycle State
    status: varchar("status", { length: 50 }).default("PENDING_REVIEW").notNull(),
    // 'VALIDATION_FAILED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'

    // Validation Diagnostics
    validationStatus: varchar("validation_status", { length: 50 }).default("VALID").notNull(),
    // 'VALID', 'INVALID', 'WARNING'
    validationErrors: jsonb("validation_errors"), // Array<{ field: string; message: string; code: string }>
    validationWarnings: jsonb("validation_warnings"), // Array<{ field: string; message: string; code: string }>

    // Curriculum Mapping Resolution
    curriculumMappingStatus: varchar("curriculum_mapping_status", { length: 50 }).default("UNMAPPED").notNull(),
    // 'MATCHED_CANONICAL', 'MATCHED_DATABASE_ID', 'MATCHED_EXACT_NAME', 'AMBIGUOUS_MATCH', 'UNMAPPED'
    academicLevelId: uuid("academic_level_id")
      .references(() => academicLevels.id)
      .notNull(),
    curriculumVersionId: uuid("curriculum_version_id")
      .references(() => curriculumVersions.id)
      .notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id),
    curriculumNodeId: uuid("curriculum_node_id").references(() => curriculumNodes.id),

    // Duplicate Detection Diagnostics
    duplicateStatus: varchar("duplicate_status", { length: 50 }).default("NO_DUPLICATE").notNull(),
    // 'NO_DUPLICATE', 'EXACT_DUPLICATE', 'POTENTIAL_DUPLICATE'
    duplicateCandidateQuestionId: uuid("duplicate_candidate_question_id").references(() => questions.id),
    duplicateCandidateVersionId: uuid("duplicate_candidate_version_id").references(() => questionVersions.id),
    duplicateSimilarityScore: integer("duplicate_similarity_score"), // 0 - 100
    duplicateMatchReason: text("duplicate_match_reason"),

    // Rejection Tracking
    rejectionReason: varchar("rejection_reason", { length: 100 }),
    // 'DUPLICATE', 'WRONG_CURRICULUM', 'INCORRECT_ANSWER', 'OUTDATED_LAW', 'POOR_QUALITY', 'OTHER'
    rejectionNotes: text("rejection_notes"),

    // Publication Tracking
    publishedQuestionId: uuid("published_question_id").references(() => questions.id),
    publishedQuestionVersionId: uuid("published_question_version_id").references(() => questionVersions.id),

    // Reviewer Audit
    reviewedBy: varchar("reviewed_by", { length: 255 }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("imported_questions_batch_idx").on(table.batchId),
    index("imported_questions_status_idx").on(table.status),
    index("imported_questions_validation_idx").on(table.validationStatus),
    index("imported_questions_mapping_idx").on(table.curriculumMappingStatus),
    index("imported_questions_duplicate_idx").on(table.duplicateStatus),
    index("imported_questions_node_idx").on(table.curriculumNodeId),
    index("imported_questions_subject_idx").on(table.subjectId),
  ]
);

export const importAuditEvents = pgTable(
  "import_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .references(() => importBatches.id, { onDelete: "cascade" })
      .notNull(),
    importedQuestionId: uuid("imported_question_id").references(() => importedQuestions.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 100 }).notNull(),
    // 'BATCH_CREATED', 'QUESTION_VALIDATED', 'QUESTION_APPROVED', 'QUESTION_REJECTED', 'QUESTION_EDITED', 'QUESTION_PUBLISHED', 'BATCH_PUBLISHED', 'BATCH_CANCELLED'
    performedBy: varchar("performed_by", { length: 255 }).notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("import_audit_events_batch_idx").on(table.batchId),
    index("import_audit_events_question_idx").on(table.importedQuestionId),
    index("import_audit_events_created_at_idx").on(table.createdAt),
  ]
);

export const questionReviews = pgTable(
  "question_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .references(() => questions.id, { onDelete: "cascade" })
      .notNull(),
    questionVersionId: uuid("question_version_id")
      .references(() => questionVersions.id, { onDelete: "cascade" })
      .notNull(),
    reviewedBy: varchar("reviewed_by", { length: 255 }).notNull(),
    decision: varchar("decision", { length: 50 }).notNull(),
    // 'REVIEWED', 'ACCEPTED', 'NEEDS_CHANGES', 'DISMISSED'
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("question_reviews_question_id_idx").on(table.questionId),
    index("question_reviews_version_id_idx").on(table.questionVersionId),
    index("question_reviews_decision_idx").on(table.decision),
    index("question_reviews_created_at_idx").on(table.createdAt),
  ]
);

