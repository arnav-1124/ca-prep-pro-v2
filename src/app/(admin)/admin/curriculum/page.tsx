import { requireAdmin } from "@/domains/auth/admin";
import { getAdminCurriculumData } from "@/domains/academics/services";
import { CurriculumExplorerClient } from "./curriculum-explorer-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Curriculum Explorer - Admin Console - CA Prep Pro",
  description: "Administrative syllabus and curriculum tree explorer.",
};

interface AdminCurriculumPageProps {
  searchParams: Promise<{
    level?: string;
    subject?: string;
  }>;
}

export default async function AdminCurriculumPage({ searchParams }: AdminCurriculumPageProps) {
  // Authoritative server-side admin guard
  await requireAdmin();

  const resolvedParams = await searchParams;
  const selectedLevelCode = resolvedParams.level || "INTERMEDIATE";

  const { levels, selectedLevel } = await getAdminCurriculumData(selectedLevelCode);

  return (
    <CurriculumExplorerClient
      levels={levels}
      selectedLevel={selectedLevel}
    />
  );
}
