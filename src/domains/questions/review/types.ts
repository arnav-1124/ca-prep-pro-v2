export type QuestionAttentionReason =
  | "OBSOLETE_CURRICULUM"
  | "INACTIVE_NODE"
  | "RETIRED_QUESTION"
  | "WEAK_EXPLANATION"
  | "FEW_OPTIONS"
  | "POTENTIAL_DUPLICATE"
  | "NEVER_REVIEWED"
  | "NEEDS_CHANGES"
  | "ZERO_USAGE"
  | "HEAVY_USAGE"
  | "MULTI_VERSIONED";

export type AttentionSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type ReviewDecision = "REVIEWED" | "ACCEPTED" | "NEEDS_CHANGES" | "DISMISSED";

export interface AttentionFlag {
  reason: QuestionAttentionReason;
  severity: AttentionSeverity;
  label: string;
  description: string;
}

export interface ReviewQueueItem {
  id: string;
  academicLevelId: string;
  academicLevelCode: string;
  academicLevelName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  curriculumVersionId: string;
  curriculumVersionName: string;
  isCurriculumVersionActive: boolean;
  curriculumNodeId: string;
  curriculumNodeCode: string;
  curriculumNodeName: string;
  isCurriculumNodeActive: boolean;
  hierarchyPath: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionType: "MCQ" | "CASE_STUDY";
  caseStudyId: string | null;
  caseStudyTitle: string | null;
  activeVersionId: string;
  versionNumber: number;
  totalVersionsCount: number;
  questionTextPreview: string;
  correctAnswer: string;
  hasExplanation: boolean;
  explanationLength: number;
  optionsCount: number;
  isActive: boolean;
  practiceAttemptsCount: number;
  testQuestionsCount: number;
  aiConversationsCount: number;
  totalUsageCount: number;
  lastAttemptedAt: Date | null;
  latestReviewDecision: ReviewDecision | null;
  latestReviewNotes: string | null;
  latestReviewedBy: string | null;
  latestReviewedAt: Date | null;
  duplicateCandidateQuestionId: string | null;
  duplicateSimilarityScore: number | null;
  duplicateMatchReason: string | null;
  attentionFlags: AttentionFlag[];
  highestSeverity: AttentionSeverity;
  createdAt: Date;
}

export interface ReviewQueueFilterParams {
  levelCode?: string;
  attentionReason?: string; // 'ALL' | QuestionAttentionReason
  severity?: string; // 'ALL' | AttentionSeverity
  subjectId?: string;
  curriculumVersionId?: string;
  reviewStatus?: string; // 'ALL' | 'UNREVIEWED' | 'REVIEWED' | 'ACCEPTED' | 'NEEDS_CHANGES' | 'DISMISSED'
  usageState?: string; // 'ALL' | 'ZERO_USAGE' | 'HEAVY_USAGE' | 'ATTEMPTED'
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "severity" | "created" | "usage" | "version" | "subject";
  sortOrder?: "asc" | "desc";
}

export interface ReviewQueueResponse {
  items: ReviewQueueItem[];
  pagination: {
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  filterOptions: {
    levels: { id: string; code: string; name: string }[];
    versions: { id: string; name: string; isActive: boolean }[];
    subjects: { id: string; code: string; name: string }[];
    selectedLevelCode: string;
  };
  metrics: {
    totalQuestionsNeedingAttention: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    unreviewedCount: number;
    obsoleteCurriculumCount: number;
    retiredCount: number;
    weakExplanationCount: number;
    needsChangesCount: number;
    zeroUsageCount: number;
  };
}

export interface RecordReviewInput {
  questionId: string;
  versionId?: string;
  decision: ReviewDecision;
  notes?: string;
  reviewerEmail?: string;
}

export interface RecordReviewResult {
  success: boolean;
  reviewId: string;
  decision: ReviewDecision;
  message: string;
}

export interface ReviewHistoryRecord {
  id: string;
  questionId: string;
  questionVersionId: string;
  versionNumber: number;
  reviewedBy: string;
  decision: ReviewDecision;
  notes: string | null;
  createdAt: Date;
}
