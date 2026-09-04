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

export type CreatePracticeSessionInput = z.infer<typeof createPracticeSessionSchema>;

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
}
