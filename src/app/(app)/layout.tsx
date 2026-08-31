import * as React from "react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateStudentProfile } from "@/domains/auth/services";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  // Safety fallback if proxy route protections did not trigger
  if (!user) {
    redirect("/sign-in");
  }

  const email = user.emailAddresses[0]?.emailAddress || "";

  // Idempotently get or create student profile record in the database
  await getOrCreateStudentProfile(user.id, email);

  return <>{children}</>;
}
