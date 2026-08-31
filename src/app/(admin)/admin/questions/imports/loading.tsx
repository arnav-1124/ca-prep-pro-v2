import { Skeleton } from "@/components/ui/skeleton";

export default function AdminImportsLoading() {
  return (
    <div className="space-y-6 font-sans">
      {/* Top Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-border bg-card rounded-2xl p-6 shadow-xs">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-lg" />
          <Skeleton className="h-7 w-64 rounded-lg" />
          <Skeleton className="h-3.5 w-96 rounded-lg" />
        </div>
        <Skeleton className="h-9.5 w-36 rounded-xl" />
      </div>

      {/* Filter Toolbar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border border-border rounded-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-40 rounded-xl" />
          <Skeleton className="h-9 w-40 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>

      {/* Batches Table Skeleton */}
      <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-lg" />
          <Skeleton className="h-4 w-20 rounded-lg" />
        </div>
        <div className="divide-y divide-border/60">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-48 rounded-md" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-72 rounded-md" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-7 w-28 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
