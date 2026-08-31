import { db } from "@/db";
import { studentProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Idempotently retrieves or provisions an application student profile mapped to a Clerk User ID.
 * Returns the matching studentProfile record.
 */
export async function getOrCreateStudentProfile(clerkUserId: string, email: string) {
  if (!clerkUserId) {
    throw new Error("Clerk User ID is required");
  }

  // 1. Check if profile exists
  const existing = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.clerkUserId, clerkUserId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // 2. Attempt to provision if not found
  try {
    const [newProfile] = await db
      .insert(studentProfiles)
      .values({
        clerkUserId,
        email,
        plan: "FREE",
      })
      .returning();
    return newProfile;
  } catch (error) {
    // Handle database concurrency: if another request created it simultaneously, return that
    const concurrent = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.clerkUserId, clerkUserId))
      .limit(1);
    if (concurrent.length > 0) {
      return concurrent[0];
    }
    throw error;
  }
}
