export type QuestionType = "MCQ" | "CASE_STUDY";
export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";
export type QuestionSourceType =
  | "STUDY_MATERIAL"
  | "RTP"
  | "MTP"
  | "PYQ"
  | "OTHER_OFFICIAL"
  | "AI_GENERATED";

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

export interface RawImportCaseStudyJson {
  title: string;
  scenarioText: string;
}

export interface RawImportQuestionJson {
  questionType?: QuestionType; // default "MCQ"
  questionText: string;
  difficulty?: QuestionDifficulty; // default "MEDIUM"
  options: RawImportOptionJson[];
  correctAnswer: string; // e.g. "A"
  explanation?: string;
  caseStudy?: RawImportCaseStudyJson;
  // Optional Curriculum mapping hints
  curriculumNodeCode?: string; // e.g. "INT_P1_CH1_T1"
  curriculumNodeId?: string; // UUID
  subjectCode?: string; // e.g. "PAPER_1"
  chapterName?: string;
  topicName?: string;
  // Optional source metadata
  sourceReference?: string;
  pageNumber?: number;
}

export interface RawImportBatchJson {
  schemaVersion?: string; // default "1.0"
  batchName?: string;
  academicLevelCode?: string; // "FOUNDATION" | "INTERMEDIATE" | "FINAL"
  curriculumVersionId?: string;
  subjectCode?: string;
  sourceType?: QuestionSourceType;
  sourceTitle?: string;
  sourceYear?: number;
  sourceMonth?: number;
  questions: RawImportQuestionJson[];
}

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

export interface QuestionValidationResult {
  isValid: boolean;
  hasWarnings: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedQuestion?: {
    questionType: QuestionType;
    questionText: string;
    difficulty: QuestionDifficulty;
    options: { letter: string; text: string }[];
    correctAnswer: string;
    explanation?: string;
    caseStudy?: { title: string; scenarioText: string };
    curriculumNodeCode?: string;
    curriculumNodeId?: string;
    subjectCode?: string;
    chapterName?: string;
    topicName?: string;
  };
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
