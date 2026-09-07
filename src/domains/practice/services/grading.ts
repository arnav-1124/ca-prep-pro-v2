/**
 * Dedicated domain-level grading engine for practice questions.
 *
 * INVARIANTS:
 * 1. Strictly deterministic: Same (questionVersion, selectedAnswer) => identical result.
 * 2. Zero AI participation: MCQ grading uses direct comparison against authoritative answer keys.
 * 3. Immutable grading snapshot: Always grades against the delivered question version.
 */

export interface GradeAnswerInput {
  questionVersion: {
    id: string;
    correctAnswer: string;
    explanation?: string | null;
  };
  selectedAnswer: string;
  validOptions: string[]; // e.g. ['A', 'B', 'C', 'D']
  optionEntities?: { letter: string; isCorrect: boolean }[];
}

export interface GradeAnswerResult {
  isCorrect: boolean;
  marksAwarded: number;
  normalizedSelectedAnswer: string;
  correctAnswer: string;
  explanation: string | null;
}

/**
 * Deterministically evaluates a student's selected answer against the authoritative question version.
 * If optionEntities with isCorrect is available, uses the entity-joined correctness directly.
 */
export function gradeAnswer(input: GradeAnswerInput): GradeAnswerResult {
  const { questionVersion, selectedAnswer, validOptions, optionEntities } = input;

  const normalizedSelected = selectedAnswer.trim().toUpperCase();
  const normalizedCorrect = questionVersion.correctAnswer.trim().toUpperCase();

  // 1. Verify option exists in valid option pool for this question
  const normalizedValidOptions = validOptions.map((opt) => opt.trim().toUpperCase());
  if (!normalizedValidOptions.includes(normalizedSelected)) {
    throw new Error(
      `Invalid option selection "${selectedAnswer}". Must be one of: ${validOptions.join(", ")}.`
    );
  }

  // 2. Deterministic correctness evaluation:
  // If optionEntities with explicit isCorrect is provided, check the entity flag directly.
  let isCorrect: boolean;
  let authoritativeCorrectLetter = normalizedCorrect;

  if (optionEntities && optionEntities.length > 0) {
    const chosen = optionEntities.find(
      (o) => o.letter.trim().toUpperCase() === normalizedSelected
    );
    isCorrect = chosen ? chosen.isCorrect : false;

    const correctEntity = optionEntities.find((o) => o.isCorrect);
    if (correctEntity) {
      authoritativeCorrectLetter = correctEntity.letter.trim().toUpperCase();
    }
  } else {
    isCorrect = normalizedSelected === normalizedCorrect;
  }

  // 3. Marks calculation (Standard: 1 mark for correct, 0 for incorrect)
  const marksAwarded = isCorrect ? 1 : 0;

  return {
    isCorrect,
    marksAwarded,
    normalizedSelectedAnswer: normalizedSelected,
    correctAnswer: authoritativeCorrectLetter,
    explanation: questionVersion.explanation || null,
  };
}
