import { db } from "@/db";
import {
  studentProfiles,
  aiUsageLogs,
  testAttempts,
  tests,
  aiConversations,
  aiMessages
} from "@/db/schema";
import { eq, and, gte, inArray, sql } from "drizzle-orm";

export type PlanType = "FREE" | "PLUS" | "PRO" | "PAID";
export type FeatureType = "EXPLANATION" | "CUSTOM_TEST" | "AI_CHAT" | "PREDICTION";

export interface FeatureLimit {
  allowed: boolean;
  limit: number;
  period: "24H" | "LIFETIME" | "UNLIMITED";
  description: string;
}

export const PLAN_DETAILS = {
  FREE: { name: "Free Tier", price: "₹0", billing: "Free forever" },
  PLUS: { name: "Plus Plan", price: "₹199", billing: "/ month" },
  PRO: { name: "Pro Plan", price: "₹599", billing: "/ month" },
  PAID: { name: "Paid Member", price: "₹599", billing: "/ month" },
};

export const PLAN_LIMITS: Record<PlanType, Record<FeatureType, FeatureLimit>> = {
  FREE: {
    EXPLANATION: { allowed: true, limit: 5, period: "24H", description: "5 AI explanations per day" },
    CUSTOM_TEST: { allowed: true, limit: 2, period: "LIFETIME", description: "2 attempts per chapter/assessment" },
    PREDICTION: { allowed: false, limit: 0, period: "LIFETIME", description: "Prediction engine access requires PRO plan" },
    AI_CHAT: { allowed: false, limit: 0, period: "24H", description: "AI Study Tutor doubt solving requires PLUS plan" },
  },
  PLUS: {
    EXPLANATION: { allowed: true, limit: 50, period: "24H", description: "50 AI explanations per day" },
    CUSTOM_TEST: { allowed: true, limit: 10, period: "LIFETIME", description: "10 attempts per chapter/assessment" },
    PREDICTION: { allowed: false, limit: 0, period: "LIFETIME", description: "Prediction engine access requires PRO plan" },
    AI_CHAT: { allowed: true, limit: 20, period: "24H", description: "20 tutor queries per day" },
  },
  PRO: {
    EXPLANATION: { allowed: true, limit: 500, period: "24H", description: "500 AI explanations per day" },
    CUSTOM_TEST: { allowed: true, limit: 9999, period: "UNLIMITED", description: "Unlimited mock tests" },
    PREDICTION: { allowed: true, limit: 9999, period: "UNLIMITED", description: "Full predictive learning access" },
    AI_CHAT: { allowed: true, limit: 500, period: "24H", description: "500 tutor queries per day" },
  },
  PAID: {
    EXPLANATION: { allowed: true, limit: 500, period: "24H", description: "500 AI explanations per day" },
    CUSTOM_TEST: { allowed: true, limit: 9999, period: "UNLIMITED", description: "Unlimited mock tests" },
    PREDICTION: { allowed: true, limit: 9999, period: "UNLIMITED", description: "Full predictive learning access" },
    AI_CHAT: { allowed: true, limit: 500, period: "24H", description: "500 tutor queries per day" },
  }
};

/**
 * Resolves the student plan type
 */
export async function getStudentPlan(studentProfileId: string): Promise<PlanType> {
  const [profile] = await db
    .select({ plan: studentProfiles.plan })
    .from(studentProfiles)
    .where(eq(studentProfiles.id, studentProfileId))
    .limit(1);
  return (profile?.plan || "FREE") as PlanType;
}

/**
 * Checks general feature allowance and returns usage stats
 */
export async function checkFeatureAllowance(
  studentProfileId: string,
  feature: FeatureType
): Promise<{ allowed: boolean; limit: number; used: number; resetTime?: Date }> {
  const plan = await getStudentPlan(studentProfileId);
  const spec = PLAN_LIMITS[plan][feature];

  if (!spec.allowed) {
    return { allowed: false, limit: 0, used: 0 };
  }

  // Handle Unlimited or extremely high limits
  if (spec.period === "UNLIMITED") {
    return { allowed: true, limit: spec.limit, used: 0 };
  }

  // Calculate usage for 24-hour renewable limits
  if (spec.period === "24H") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const resetTime = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    let used = 0;
    if (feature === "EXPLANATION") {
      const [usageCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiUsageLogs)
        .where(
          and(
            eq(aiUsageLogs.studentProfileId, studentProfileId),
            eq(aiUsageLogs.action, "EXPLANATION"),
            gte(aiUsageLogs.createdAt, startOfToday)
          )
        );
      used = usageCount?.count || 0;
    } else if (feature === "AI_CHAT") {
      // Find all conversations started by student
      const userConvs = await db
        .select({ id: aiConversations.id })
        .from(aiConversations)
        .where(eq(aiConversations.studentProfileId, studentProfileId));
      
      const convIds = userConvs.map(c => c.id);
      if (convIds.length > 0) {
        const [usageCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(aiMessages)
          .where(
            and(
              inArray(aiMessages.conversationId, convIds),
              eq(aiMessages.role, "user"),
              gte(aiMessages.createdAt, startOfToday)
            )
          );
        used = usageCount?.count || 0;
      }
    }

    return {
      allowed: used < spec.limit,
      limit: spec.limit,
      used,
      resetTime,
    };
  }

  return { allowed: true, limit: spec.limit, used: 0 };
}

/**
 * Checks specifically if a student can attempt a test based on attempts history
 */
export async function checkTestAttemptAllowance(
  studentProfileId: string,
  testId: string
): Promise<{ allowed: boolean; limit: number; used: number; reason?: string }> {
  const plan = await getStudentPlan(studentProfileId);
  const spec = PLAN_LIMITS[plan]["CUSTOM_TEST"];

  if (spec.period === "UNLIMITED") {
    return { allowed: true, limit: spec.limit, used: 0 };
  }

  // Fetch test scope
  const [test] = await db
    .select({ id: tests.id, curriculumNodeId: tests.curriculumNodeId })
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1);

  if (!test) {
    throw new Error("Test does not exist.");
  }

  let attemptsCount = 0;
  let contextType = "chapter";

  if (test.curriculumNodeId) {
    // Chapter-specific test limit check: Find all tests sharing the same curriculum node
    const testsSharingChapter = await db
      .select({ id: tests.id })
      .from(tests)
      .where(eq(tests.curriculumNodeId, test.curriculumNodeId));

    const testIds = testsSharingChapter.map((t) => t.id);

    if (testIds.length > 0) {
      // Count attempts on any test in this chapter
      const attempts = await db
        .select({ id: testAttempts.id })
        .from(testAttempts)
        .where(
          and(
            eq(testAttempts.studentProfileId, studentProfileId),
            inArray(testAttempts.testId, testIds)
          )
        );
      attemptsCount = attempts.length;
    }
  } else {
    // Subject-wide mixed test: limit applies per test
    contextType = "comprehensive assessment";
    const attempts = await db
      .select({ id: testAttempts.id })
      .from(testAttempts)
      .where(
        and(
          eq(testAttempts.studentProfileId, studentProfileId),
          eq(testAttempts.testId, testId)
        )
      );
    attemptsCount = attempts.length;
  }

  const allowed = attemptsCount < spec.limit;
  const reason = allowed
    ? undefined
    : `You have reached the plan limit of ${spec.limit} attempts for this ${contextType}. Upgrade your plan for higher or unlimited practice assessments.`;

  return {
    allowed,
    limit: spec.limit,
    used: attemptsCount,
    reason,
  };
}
