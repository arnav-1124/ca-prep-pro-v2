import { requireAdmin } from "@/domains/auth/admin";
import { getAdminCurriculumVersionsData } from "@/domains/academics/services";
import { VersionsClient } from "./versions-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Curriculum Versions - Admin Console - CA Prep Pro",
  description: "Administrative curriculum version management and activation.",
};

interface AdminVersionsPageProps {
  searchParams: Promise<{
    level?: string;
  }>;
}

export default async function AdminVersionsPage({ searchParams }: AdminVersionsPageProps) {
  // 1. Authoritative server-side admin authorization guard
  await requireAdmin();

  const resolvedParams = await searchParams;
  const selectedLevelCode = resolvedParams.level || "INTERMEDIATE";

  const { levels, versions } = await getAdminCurriculumVersionsData(selectedLevelCode);

  return (
    <VersionsClient
      levels={levels}
      versions={versions}
      selectedLevelCode={selectedLevelCode}
    />
  );
}
