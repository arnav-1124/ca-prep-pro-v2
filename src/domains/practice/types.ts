import { z } from "zod";

/**
 * Zod schema for client input when creating a new practice session.
 */
export const createPracticeSessionSchema = z.object({
  academicLevelId: z.string().uuid("Invalid academic level ID"),
  subjectId: z.string().uuid("Invalid subject ID").optional().nullable(),
  curriculumNodeId: z.string().uuid("Invalid curriculum node ID").optional().nullable(),
  practiceMode: z.enum(["QUESTION", "CASE_STUDY"]).default("QUESTION"),
  difficulty: z.enum(["ANY", "EASY", "MEDIUM", "HARD"]).default("ANY"),
  questionType: z.enum(["MCQ", "CASE_STUDY"]).default("MCQ"),
  requestedQuestionCount: z.number().int().min(1).max(50).default(10),
});

export type CreatePracticeSessionInput = z.input<typeof createPracticeSessionSchema>;
export type ValidatedCreatePracticeSessionInput = z.infer<typeof createPracticeSessionSchema>;

/**
 * Sanitized question option view model for student practice.
 * Strictly does NOT include any correctness indicators.
 */
export interface StudentPracticeOptionDto {
  id: string;
  optionLetter: string; // 'A', 'B', 'C', 'D'
  optionText: string;
}

/**
 * Sanitized case study context view model for student practice.
 * Excludes internal review, batch or author metadata.
 */
export interface StudentPracticeCaseStudyDto {
  id: string;
  title: string;
  scenarioText: string;
}

/**
 * Student Practice Question Delivery DTO.
 *
 * INVARIANT: Never exposes:
 * - correctAnswer
 * - explanation
 * - internal admin flags
 * - AI prompts / review audits
 * - duplicate detection scores
 */
export interface StudentPracticeQuestionDto {
  sessionQuestionId: string;
  sessionId: string;
  questionId: string;
  questionVersionId: string;
  sequenceNumber: number; // 1-indexed progression within the session
  totalQuestions: number; // requested/capped count for the session
  questionType: "MCQ" | "CASE_STUDY";
  difficulty: string;
  questionText: string;
  options: StudentPracticeOptionDto[];
  caseStudy?: StudentPracticeCaseStudyDto | null;
  curriculumContext: {
    levelName: string;
    subjectName: string | null;
    nodeName: string | null;
  };
  deliveredAt: string; // ISO timestamp
}

/**
 * Summary view of a practice session for headers / status indicators.
 */
export interface PracticeSessionDetailsDto {
  id: string;
  studentProfileId: string;
  academicLevelId: string;
  levelName: string;
  curriculumVersionId: string | null;
  subjectId: string | null;
  subjectName: string | null;
  curriculumNodeId: string | null;
  curriculumNodeName: string | null;
  status: "ACTIVE" | "COMPLETED" | "ABANDONED";
  practiceMode: "QUESTION" | "CASE_STUDY";
  difficulty: string;
  questionType: string;
  questionCount: number;
  deliveredCount: number;
  startedAt: string;
  completedAt: string | null;
}

/**
 * Result returned when querying the next question in a session.
 */
export interface NextQuestionResult {
  isCompleted: boolean;
  question: StudentPracticeQuestionDto | null;
  deliveredCount: number;
  totalQuestions: number;
  message?: string;
}

/**
 * Result returned when querying the current question in a session.
 */
export interface CurrentQuestionResult {
  isCompleted: boolean;
  question: StudentPracticeQuestionDto | null;
  session: PracticeSessionDetailsDto;
  existingAttempt?: SubmitAnswerResultDto | null;
}

/**
 * Zod schema for client answer submission input.
 */
export const submitAnswerSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  sessionQuestionId: z.string().uuid("Invalid session question ID"),
  selectedAnswer: z.string().min(1, "Selected answer cannot be empty"),
  timeSpentSeconds: z.number().int().min(0).max(7200).optional().default(0),
});

export type SubmitAnswerInput = z.input<typeof submitAnswerSchema>;
export type ValidatedSubmitAnswerInput = z.infer<typeof submitAnswerSchema>;

/**
 * Authoritative real-time session progress and metrics.
 */
export interface PracticeSessionProgressDto {
  totalQuestions: number;
  deliveredCount: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracyPercentage: number;
  currentScore: number;
  maxPossibleScore: number;
}

/**
 * Student-safe result returned upon successful answer submission.
 *
 * INVARIANT: Answer key and explanation are revealed strictly
 * AFTER the answer has been graded and persisted.
 */
export interface SubmitAnswerResultDto {
  attemptId: string;
  sessionId: string;
  sessionQuestionId: string;
  questionVersionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  correctAnswer: string; // Authoritative answer key from delivered version
  explanation: string | null; // Academic explanation from delivered version
  marksAwarded: number;
  sessionProgress: PracticeSessionProgressDto;
  isSessionCompleted: boolean;
}

/**
 * Item review model for completed practice sets.
 */
export interface PracticeQuestionReviewItemDto {
  sessionQuestionId: string;
  sequenceNumber: number;
  questionText: string;
  questionType: "MCQ" | "CASE_STUDY";
  difficulty: string;
  options: StudentPracticeOptionDto[];
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean | null;
  explanation: string | null;
  marksAwarded: number;
  timeSpentSeconds: number;
}

/**
 * Complete summary model for completed practice sessions.
 */
export interface PracticeSessionSummaryDto {
  session: PracticeSessionDetailsDto;
  progress: PracticeSessionProgressDto;
  reviewItems: PracticeQuestionReviewItemDto[];
}

