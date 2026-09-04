import {
  CanonicalBatchJson,
  CanonicalQuestionJson,
  QuestionValidationResult,
  BatchValidationResult,
  ValidationError,
  ValidationWarning,
  QuestionType,
  QuestionDifficulty,
  QuestionSourceType,
  SanitizedQuestionPayload,
} from "./types";

const VALID_TYPES: QuestionType[] = ["MCQ", "CASE_STUDY"];
const VALID_DIFFICULTIES: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"];
const VALID_SOURCE_TYPES: QuestionSourceType[] = [
  "STUDY_MATERIAL",
  "RTP",
  "MTP",
  "PYQ",
  "REVISION_MATERIAL",
  "MOCK_TEST",
  "OTHER_OFFICIAL",
  "AI_GENERATED",
  "OTHER",
];
const SUPPORTED_SCHEMA_VERSIONS = ["1.0", "2.0"];
const MAX_BATCH_SIZE = 500;

/**
 * Validates a single imported question payload (Schema v2.0 & v1.0).
 */
export function validateImportQuestion(
  raw: unknown,
  questionIndex: number = 1,
  availableCaseStudyRefs?: Set<string>
): QuestionValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      isValid: false,
      hasWarnings: false,
      errors: [
        {
          questionIndex,
          field: "root",
          message: "Question item must be a valid JSON object.",
          code: "INVALID_OBJECT",
        },
      ],
      warnings: [],
    };
  }

  const q = raw as Partial<CanonicalQuestionJson>;

  // 1. Question Text
  if (typeof q.questionText !== "string" || !q.questionText.trim()) {
    errors.push({
      questionIndex,
      field: "questionText",
      message: "Question text is required and cannot be empty.",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else {
    const trimmed = q.questionText.trim();
    if (trimmed.length < 10) {
      errors.push({
        questionIndex,
        field: "questionText",
        message: `Question text is too short (${trimmed.length} chars). Minimum length is 10 characters.`,
        code: "TEXT_TOO_SHORT",
      });
    } else if (trimmed.length > 10000) {
      errors.push({
        questionIndex,
        field: "questionText",
        message: "Question text exceeds maximum length of 10,000 characters.",
        code: "TEXT_TOO_LONG",
      });
    }

    if (!/[?.!:]$/.test(trimmed)) {
      warnings.push({
        questionIndex,
        field: "questionText",
        message: "Question text does not end with standard punctuation (?, ., :).",
        code: "MISSING_PUNCTUATION",
      });
    }
  }

  // 2. Question Type
  let questionType: QuestionType = "MCQ";
  if (q.questionType !== undefined) {
    if (typeof q.questionType !== "string" || !VALID_TYPES.includes(q.questionType as QuestionType)) {
      errors.push({
        questionIndex,
        field: "questionType",
        message: `Invalid questionType "${q.questionType}". Permitted types: ${VALID_TYPES.join(", ")}.`,
        code: "INVALID_ENUM_VALUE",
      });
    } else {
      questionType = q.questionType as QuestionType;
    }
  }

  // 3. Difficulty
  let difficulty: QuestionDifficulty = "MEDIUM";
  if (q.difficulty !== undefined) {
    const upperDiff = String(q.difficulty).toUpperCase() as QuestionDifficulty;
    if (!VALID_DIFFICULTIES.includes(upperDiff)) {
      errors.push({
        questionIndex,
        field: "difficulty",
        message: `Invalid difficulty "${q.difficulty}". Permitted values: ${VALID_DIFFICULTIES.join(", ")}.`,
        code: "INVALID_ENUM_VALUE",
      });
    } else {
      difficulty = upperDiff;
    }
  }

  // 4. Options Validation (for MCQ and CASE_STUDY MCQs)
  const validOptions: { letter: string; text: string }[] = [];
  if (!Array.isArray(q.options) || q.options.length === 0) {
    errors.push({
      questionIndex,
      field: "options",
      message: "Question must have an array of options (minimum 2 options).",
      code: "MISSING_OPTIONS",
    });
  } else if (q.options.length < 2) {
    errors.push({
      questionIndex,
      field: "options",
      message: `Question has only ${q.options.length} option(s). At least 2 options are required.`,
      code: "TOO_FEW_OPTIONS",
    });
  } else if (q.options.length > 6) {
    errors.push({
      questionIndex,
      field: "options",
      message: `Question has ${q.options.length} options. Maximum allowed is 6 options.`,
      code: "TOO_MANY_OPTIONS",
    });
  } else {
    const seenLetters = new Set<string>();

    q.options.forEach((opt, optIdx) => {
      if (!opt || typeof opt !== "object") {
        errors.push({
          questionIndex,
          field: `options[${optIdx}]`,
          message: `Option at index ${optIdx} is not a valid object.`,
          code: "INVALID_OPTION_OBJECT",
        });
        return;
      }

      const letter = typeof opt.letter === "string" ? opt.letter.trim().toUpperCase() : "";
      const text = typeof opt.text === "string" ? opt.text.trim() : "";

      if (!letter) {
        errors.push({
          questionIndex,
          field: `options[${optIdx}].letter`,
          message: `Option at index ${optIdx} is missing an option letter (e.g. "A", "B").`,
          code: "MISSING_OPTION_LETTER",
        });
      } else if (seenLetters.has(letter)) {
        errors.push({
          questionIndex,
          field: `options[${optIdx}].letter`,
          message: `Duplicate option letter "${letter}" found at index ${optIdx}.`,
          code: "DUPLICATE_OPTION_LETTER",
        });
      } else {
        seenLetters.add(letter);
      }

      if (!text) {
        errors.push({
          questionIndex,
          field: `options[${optIdx}].text`,
          message: `Option ${letter || `#${optIdx + 1}`} has empty text.`,
          code: "EMPTY_OPTION_TEXT",
        });
      }

      if (letter && text) {
        validOptions.push({ letter, text });
      }
    });
  }

  // 5. Correct Answer Matching
  let correctAnswer = "";
  if (typeof q.correctAnswer !== "string" || !q.correctAnswer.trim()) {
    errors.push({
      questionIndex,
      field: "correctAnswer",
      message: 'correctAnswer is required (e.g. "A", "B", "C", "D").',
      code: "REQUIRED_FIELD_MISSING",
    });
  } else {
    correctAnswer = q.correctAnswer.trim().toUpperCase();
    const availableLetters = validOptions.map((o) => o.letter);
    if (availableLetters.length > 0 && !availableLetters.includes(correctAnswer)) {
      errors.push({
        questionIndex,
        field: "correctAnswer",
        message: `correctAnswer "${correctAnswer}" does not match any provided option letters [${availableLetters.join(", ")}].`,
        code: "INVALID_CORRECT_ANSWER_KEY",
      });
    }
  }

  // 6. Explanation
  const explanation = typeof q.explanation === "string" ? q.explanation.trim() : undefined;
  if (!explanation) {
    warnings.push({
      questionIndex,
      field: "explanation",
      message: "No explanation provided. An academic explanation improves student learning quality.",
      code: "MISSING_EXPLANATION",
    });
  }

  // 7. Case Study (if type === CASE_STUDY)
  let caseStudy: { caseStudyRef?: string; title: string; scenarioText: string } | undefined;
  const caseStudyRef = typeof q.caseStudyRef === "string" ? q.caseStudyRef.trim() : undefined;

  if (questionType === "CASE_STUDY") {
    if (caseStudyRef) {
      if (availableCaseStudyRefs && !availableCaseStudyRefs.has(caseStudyRef)) {
        errors.push({
          questionIndex,
          field: "caseStudyRef",
          message: `caseStudyRef "${caseStudyRef}" does not match any declared batch-level case studies.`,
          code: "UNRESOLVED_CASE_STUDY_REF",
        });
      }
    } else if (q.caseStudy && typeof q.caseStudy === "object") {
      const csTitle = typeof q.caseStudy.title === "string" ? q.caseStudy.title.trim() : "";
      const csScenario = typeof q.caseStudy.scenarioText === "string" ? q.caseStudy.scenarioText.trim() : "";

      if (!csTitle) {
        errors.push({
          questionIndex,
          field: "caseStudy.title",
          message: "Case study title is required.",
          code: "MISSING_CASE_STUDY_TITLE",
        });
      }
      if (!csScenario || csScenario.length < 20) {
        errors.push({
          questionIndex,
          field: "caseStudy.scenarioText",
          message: "Case study scenarioText is required (minimum 20 characters).",
          code: "INVALID_CASE_STUDY_SCENARIO",
        });
      }

      if (csTitle && csScenario) {
        caseStudy = {
          caseStudyRef: q.caseStudy.caseStudyRef?.trim() || undefined,
          title: csTitle,
          scenarioText: csScenario,
        };
      }
    } else {
      errors.push({
        questionIndex,
        field: "caseStudy",
        message: 'Questions with questionType "CASE_STUDY" must declare a caseStudy object or a valid caseStudyRef.',
        code: "MISSING_CASE_STUDY_PAYLOAD",
      });
    }
  }

  // 8. Source Metadata Validation
  if (q.source?.sourceType && !VALID_SOURCE_TYPES.includes(q.source.sourceType)) {
    warnings.push({
      questionIndex,
      field: "source.sourceType",
      message: `Unrecognized sourceType "${q.source.sourceType}". Supported types: ${VALID_SOURCE_TYPES.join(", ")}.`,
      code: "UNKNOWN_SOURCE_TYPE",
    });
  }

  const isValid = errors.length === 0;

  let sanitized: SanitizedQuestionPayload | undefined;
  if (isValid) {
    sanitized = {
      externalId: typeof q.externalId === "string" ? q.externalId.trim() : undefined,
      questionType,
      questionText: q.questionText!.trim(),
      difficulty,
      options: validOptions,
      correctAnswer,
      explanation,
      caseStudy,
      caseStudyRef,
      curriculum: q.curriculum
        ? {
            subjectCode: typeof q.curriculum.subjectCode === "string" ? q.curriculum.subjectCode.trim() : undefined,
            chapterCode: typeof q.curriculum.chapterCode === "string" ? q.curriculum.chapterCode.trim() : undefined,
            unitCode: typeof q.curriculum.unitCode === "string" ? q.curriculum.unitCode.trim() : undefined,
            topicCode: typeof q.curriculum.topicCode === "string" ? q.curriculum.topicCode.trim() : undefined,
            nodeCode: typeof q.curriculum.nodeCode === "string" ? q.curriculum.nodeCode.trim() : undefined,
            curriculumNodeId: typeof q.curriculum.curriculumNodeId === "string" ? q.curriculum.curriculumNodeId.trim() : undefined,
            _subjectTitle: typeof q.curriculum._subjectTitle === "string" ? q.curriculum._subjectTitle.trim() : undefined,
            _chapterTitle: typeof q.curriculum._chapterTitle === "string" ? q.curriculum._chapterTitle.trim() : undefined,
            _unitTitle: typeof q.curriculum._unitTitle === "string" ? q.curriculum._unitTitle.trim() : undefined,
            _topicTitle: typeof q.curriculum._topicTitle === "string" ? q.curriculum._topicTitle.trim() : undefined,
          }
        : undefined,
      source: q.source,
      // Legacy compatibility
      curriculumNodeCode: typeof q.curriculumNodeCode === "string" ? q.curriculumNodeCode.trim() : q.curriculum?.nodeCode,
      curriculumNodeId: typeof q.curriculumNodeId === "string" ? q.curriculumNodeId.trim() : q.curriculum?.curriculumNodeId,
      subjectCode: typeof q.subjectCode === "string" ? q.subjectCode.trim() : q.curriculum?.subjectCode,
      chapterName: typeof q.chapterName === "string" ? q.chapterName.trim() : q.curriculum?._chapterTitle,
      topicName: typeof q.topicName === "string" ? q.topicName.trim() : q.curriculum?._topicTitle,
    };
  }

  return {
    isValid,
    hasWarnings: warnings.length > 0,
    errors,
    warnings,
    sanitizedQuestion: sanitized,
  };
}

/**
 * Validates an entire batch payload containing multiple questions (Schema v2.0 & v1.0).
 */
export function validateImportBatch(rawPayload: unknown): BatchValidationResult {
  const batchErrors: string[] = [];

  if (!rawPayload || typeof rawPayload !== "object") {
    return {
      isValid: false,
      totalQuestions: 0,
      validCount: 0,
      invalidCount: 0,
      batchErrors: ["Uploaded payload is not a valid JSON object."],
      questionResults: [],
    };
  }

  let questionsArray: unknown[] = [];
  const availableCaseStudyRefs = new Set<string>();

  if (Array.isArray(rawPayload)) {
    questionsArray = rawPayload;
  } else {
    const batch = rawPayload as Partial<CanonicalBatchJson>;

    // Check schemaVersion if present
    if (batch.schemaVersion !== undefined && typeof batch.schemaVersion === "string") {
      if (!SUPPORTED_SCHEMA_VERSIONS.includes(batch.schemaVersion.trim())) {
        batchErrors.push(
          `Unsupported schemaVersion "${batch.schemaVersion}". Supported versions: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}.`
        );
      }
    }

    // Collect batch-level shared case studies
    if (Array.isArray(batch.caseStudies)) {
      batch.caseStudies.forEach((cs, csIdx) => {
        if (cs && typeof cs === "object" && typeof cs.caseStudyRef === "string" && cs.caseStudyRef.trim()) {
          availableCaseStudyRefs.add(cs.caseStudyRef.trim());
        } else if (cs && typeof cs === "object" && typeof cs.title === "string" && cs.title.trim()) {
          availableCaseStudyRefs.add(cs.title.trim());
        } else {
          batchErrors.push(`Case study at index ${csIdx} is missing a title or caseStudyRef.`);
        }
      });
    }

    if (!Array.isArray(batch.questions)) {
      return {
        isValid: false,
        totalQuestions: 0,
        validCount: 0,
        invalidCount: 0,
        batchErrors: ['Missing "questions" array in root JSON payload.'],
        questionResults: [],
      };
    }
    questionsArray = batch.questions;
  }

  if (questionsArray.length === 0) {
    return {
      isValid: batchErrors.length === 0,
      totalQuestions: 0,
      validCount: 0,
      invalidCount: 0,
      batchErrors,
      questionResults: [],
    };
  }

  if (questionsArray.length > MAX_BATCH_SIZE) {
    batchErrors.push(
      `Batch contains ${questionsArray.length} questions, which exceeds the maximum limit of ${MAX_BATCH_SIZE} questions per batch.`
    );
  }

  // Check for duplicate externalIds within batch
  const seenExternalIds = new Set<string>();
  questionsArray.forEach((q, idx) => {
    if (q && typeof q === "object" && "externalId" in q && typeof (q as { externalId?: unknown }).externalId === "string") {
      const extId = (q as { externalId: string }).externalId.trim();
      if (extId) {
        if (seenExternalIds.has(extId)) {
          batchErrors.push(`Duplicate externalId "${extId}" found at question index ${idx + 1}. External IDs must be unique within batch.`);
        } else {
          seenExternalIds.add(extId);
        }
      }
    }
  });

  const questionResults = questionsArray.map((q, idx) =>
    validateImportQuestion(q, idx + 1, availableCaseStudyRefs.size > 0 ? availableCaseStudyRefs : undefined)
  );
  const validCount = questionResults.filter((r) => r.isValid).length;
  const invalidCount = questionResults.filter((r) => !r.isValid).length;

  return {
    isValid: batchErrors.length === 0 && invalidCount === 0,
    totalQuestions: questionsArray.length,
    validCount,
    invalidCount,
    batchErrors,
    questionResults,
  };
}
