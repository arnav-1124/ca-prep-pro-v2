import { Metadata } from "next";
import { requireAdmin } from "@/domains/auth/admin";
import { getImportBatchesData } from "@/domains/questions/import/services";
import { db } from "@/db";
import { academicLevels, curriculumVersions, subjects } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { AdminImportsClient } from "./imports-client";

export const metadata: Metadata = {
  title: "Question Import Batches | Admin Console — CA Prep Pro",
  description: "Upload, validate, and manage structured question import batches for human review.",
};

interface AdminImportsPageProps {
  searchParams: Promise<{
    level?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function AdminImportsPage(props: AdminImportsPageProps) {
  await requireAdmin();

  const searchParams = await props.searchParams;
  const levelCode = searchParams.level || "ALL";
  const status = searchParams.status || "ALL";
  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = parseInt(searchParams.pageSize || "10", 10);

  // 1. Fetch Paginated Import Batches
  const { batches, levels, pagination } = await getImportBatchesData({
    levelCode,
    status,
    page,
    pageSize,
  });

  // 2. Fetch Active Curriculum Versions & Subjects for Upload Modal Dropdowns
  const allLevels = await db.select().from(academicLevels);
  const allVersions = await db
    .select()
    .from(curriculumVersions)
    .orderBy(asc(curriculumVersions.applicableFrom));
  const allSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.isActive, true))
    .orderBy(asc(subjects.sortOrder));

  return (
    <AdminImportsClient
      initialBatches={batches}
      levels={levels}
      pagination={pagination}
      selectedLevel={levelCode}
      selectedStatus={status}
      modalData={{
        allLevels,
        allVersions,
        allSubjects,
      }}
    />
  );
}
