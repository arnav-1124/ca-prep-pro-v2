export type QuestionType = "MCQ" | "CASE_STUDY";
export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";
export type QuestionSourceType =
  | "STUDY_MATERIAL"
  | "RTP"
  | "MTP"
  | "PYQ"
  | "REVISION_MATERIAL"
  | "MOCK_TEST"
  | "OTHER_OFFICIAL"
  | "AI_GENERATED"
  | "OTHER";

export type ImportBatchStatus =
  | "PROCESSING"
  | "PENDING_REVIEW"
  | "PARTIALLY_APPROVED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type ImportedQuestionStatus =
  | "VALIDATION_FAILED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED";

export type CurriculumMappingStatus =
  | "MATCHED_CANONICAL"
  | "MATCHED_DATABASE_ID"
  | "MATCHED_EXACT_NAME"
  | "AMBIGUOUS_MATCH"
  | "UNMAPPED";

export type DuplicateStatus =
  | "NO_DUPLICATE"
  | "EXACT_DUPLICATE"
  | "POTENTIAL_DUPLICATE";

export type RejectionReason =
  | "DUPLICATE"
  | "WRONG_CURRICULUM"
  | "INCORRECT_ANSWER"
  | "OUTDATED_LAW"
  | "POOR_QUALITY"
  | "FORMATTING_ISSUE"
  | "OTHER";

export interface RawImportOptionJson {
  letter: string; // "A", "B", "C", "D"
  text: string;
}

export interface CanonicalCaseStudyJson {
  caseStudyRef?: string; // e.g. "CS_01"
  title: string;
  scenarioText: string;
}

export type RawImportCaseStudyJson = CanonicalCaseStudyJson;

/**
 * Curriculum coordinates for a question.
 * Hierarchical references (Subject -> Chapter -> Unit -> Topic) are resolved against the active curriculum version.
 */
export interface CanonicalCurriculumRef {
  subjectCode?: string; // e.g. "PAPER_1", "TAX"
  chapterCode?: string; // e.g. "CH_01", "INT_P1_CH1"
  unitCode?: string; // e.g. "UNIT_01"
  topicCode?: string; // e.g. "TOPIC_01"
  nodeCode?: string; // Full canonical node code if known (e.g. "INT_P1_CH1_T1")
  curriculumNodeId?: string; // Direct UUID if known
  // Informational display hints (non-authoritative for identity)
  _subjectTitle?: string;
  _chapterTitle?: string;
  _unitTitle?: string;
  _topicTitle?: string;
}

/**
 * Granular Source & Attempt Metadata.
 * Distinguishes source publication attempt from question applicability.
 */
export interface CanonicalSourceMetadata {
  sourceType?: QuestionSourceType;
  sourceTitle?: string;
  sourceYear?: number;
  sourceMonth?: number;
  sourceAttempt?: string; // Originating attempt (e.g. "MAY_2026", "RTP May 2026")
  applicability?: string[]; // Target exam cycles (e.g. ["MAY_2026", "NOV_2026", "MAY_2027"])
  paperNumber?: string;
  pageNumber?: number;
  questionNumber?: string;
  sourceReference?: string;
  sourceUrl?: string;
  externalId?: string;
}

/**
 * Authoritative Canonical Question Object (Schema v2.0).
 */
export interface CanonicalQuestionJson {
  externalId?: string; // Stable unique question identifier within batch/source
  questionType?: QuestionType; // default "MCQ"
  questionText: string;
  difficulty?: QuestionDifficulty; // default "MEDIUM"
  curriculum?: CanonicalCurriculumRef;
  options: RawImportOptionJson[];
  correctAnswer: string; // e.g. "A"
  explanation?: string;
  source?: CanonicalSourceMetadata;
  caseStudy?: CanonicalCaseStudyJson;
  caseStudyRef?: string; // Reference to a shared case study defined at batch level

  // Backward compatibility fields for v1.0 imports
  curriculumNodeCode?: string;
  curriculumNodeId?: string;
  subjectCode?: string;
  chapterName?: string;
  topicName?: string;
  sourceReference?: string;
  pageNumber?: number;
}

export type RawImportQuestionJson = CanonicalQuestionJson;

/**
 * Authoritative Canonical Import/Export Batch Payload (Schema v2.0).
 */
export interface CanonicalBatchJson {
  schemaVersion?: string; // "2.0" (default) or "1.0"
  batchName?: string;
  academicLevelCode?: string; // "FOUNDATION" | "INTERMEDIATE" | "FINAL"
  curriculumVersionId?: string;
  curriculumVersionCode?: string;
  curriculumVersionName?: string;
  subjectCode?: string;
  sourceType?: QuestionSourceType;
  sourceTitle?: string;
  sourceYear?: number;
  sourceMonth?: number;
  exportedAt?: string;
  caseStudies?: CanonicalCaseStudyJson[]; // Shared case studies referenced by questions
  questions: CanonicalQuestionJson[];
}

export type RawImportBatchJson = CanonicalBatchJson;

export interface ValidationError {
  questionIndex?: number;
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  questionIndex?: number;
  field: string;
  message: string;
  code: string;
}

export interface SanitizedQuestionPayload {
  externalId?: string;
  questionType: QuestionType;
  questionText: string;
  difficulty: QuestionDifficulty;
  options: { letter: string; text: string }[];
  correctAnswer: string;
  explanation?: string;
  caseStudy?: { caseStudyRef?: string; title: string; scenarioText: string };
  caseStudyRef?: string;
  curriculum?: CanonicalCurriculumRef;
  source?: CanonicalSourceMetadata;
  // Legacy aliases
  curriculumNodeCode?: string;
  curriculumNodeId?: string;
  subjectCode?: string;
  chapterName?: string;
  topicName?: string;
}

export interface QuestionValidationResult {
  isValid: boolean;
  hasWarnings: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedQuestion?: SanitizedQuestionPayload;
}

export interface BatchValidationResult {
  isValid: boolean;
  totalQuestions: number;
  validCount: number;
  invalidCount: number;
  batchErrors: string[];
  questionResults: QuestionValidationResult[];
}

export interface CurriculumResolutionResult {
  status: CurriculumMappingStatus;
  academicLevelId: string;
  curriculumVersionId: string;
  subjectId: string | null;
  curriculumNodeId: string | null;
  matchDescription: string;
  breadcrumbs: {
    levelName: string;
    versionName: string;
    subjectName?: string;
    nodeName?: string;
    nodeCode?: string;
  };
}

export interface DuplicateDetectionResult {
  status: DuplicateStatus;
  similarityScore: number; // 0 to 100
  candidateQuestionId: string | null;
  candidateVersionId: string | null;
  candidatePreviewText?: string;
  matchReason: string | null;
}

export interface EditQuestionPayload {
  questionText: string;
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  options: { letter: string; text: string }[];
  correctAnswer: string;
  explanation?: string;
  curriculumNodeId?: string;
  subjectId?: string;
  caseStudy?: { title: string; scenarioText: string };
}
