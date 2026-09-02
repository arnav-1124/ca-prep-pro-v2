import { QuestionDifficulty, QuestionType } from "../import/types";

export interface UpdateQuestionInput {
  questionId: string;
  questionText: string;
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  options: { letter: string; text: string }[];
  correctAnswer: string;
  explanation?: string;
  curriculumNodeId: string;
  caseStudy?: { title: string; scenarioText: string } | null;
  createNewVersion?: boolean; // Force version creation even if 0 attempts
  adminEmail: string;
  expectedUpdatedAt?: Date | string;
}

export interface UpdateQuestionResult {
  success: boolean;
  questionId: string;
  versionId: string;
  versionNumber: number;
  createdNewVersion: boolean;
  message?: string;
}

export interface ToggleQuestionStatusInput {
  questionId: string;
  isActive: boolean;
  adminEmail: string;
  expectedUpdatedAt?: Date | string;
}

export interface DeleteQuestionInput {
  questionId: string;
  adminEmail: string;
}

export interface DeleteQuestionResult {
  success: boolean;
  message: string;
  practiceAttemptsCount: number;
  testQuestionsCount: number;
  aiConversationsCount: number;
}

export interface ExportQuestionsInput {
  levelCode?: string;
  curriculumVersionId?: string;
  subjectId?: string;
  curriculumNodeId?: string;
  questionType?: string;
  difficulty?: string;
  sourceType?: string;
  status?: string;
  searchQuery?: string;
  limit?: number;
}

export interface ExportQuestionsResult {
  fileName: string;
  jsonContent: string;
  questionCount: number;
}
