import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateStudentProfile } from "./services";

export interface AdminUserContext {
  userId: string;
  email: string;
  studentProfileId: string;
  role: "SUPER_ADMIN" | "ADMIN";
}

/**
 * Resolves the configured bootstrap admin email from server-side environment variables.
 * Defaults to "arnavgupta112@gmail.com".
 */
export function getBootstrapAdminEmail(): string {
  return (process.env.BOOTSTRAP_ADMIN_EMAIL || "arnavgupta112@gmail.com").trim().toLowerCase();
}

/**
 * Checks if a specific email matches the administrator configuration.
 */
export function isEmailAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  const adminEmail = getBootstrapAdminEmail();
  return email.trim().toLowerCase() === adminEmail;
}

/**
 * Server-side check to determine if the currently authenticated Clerk user is an administrator.
 */
export async function isCurrentAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;

  const emails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase());
  const adminEmail = getBootstrapAdminEmail();
  return emails.includes(adminEmail);
}

/**
 * Authoritative server-side guard asserting that the caller is an authorized administrator.
 * Returns the verified AdminUserContext or throws an error.
 * Designed for seamless future RBAC expansion.
 */
export async function requireAdmin(): Promise<AdminUserContext> {
  const user = await currentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  const emails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase());
  const adminEmail = getBootstrapAdminEmail();
  const matchedEmail = emails.find((e) => e === adminEmail);

  if (!matchedEmail) {
    console.warn(`[Security Alert] Non-admin user (${user.id}, ${emails.join(", ")}) attempted admin access.`);
    throw new Error("UNAUTHORIZED_ADMIN_ACCESS");
  }

  const profile = await getOrCreateStudentProfile(user.id, matchedEmail);

  return {
    userId: user.id,
    email: matchedEmail,
    studentProfileId: profile.id,
    role: "SUPER_ADMIN",
  };
}
