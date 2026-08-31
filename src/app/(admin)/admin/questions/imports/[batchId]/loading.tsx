import { Skeleton } from "@/components/ui/skeleton";

export default function AdminBatchReviewLoading() {
  return (
    <div className="space-y-6 font-sans">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-border bg-card rounded-2xl p-6 shadow-xs">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-lg" />
          <Skeleton className="h-7 w-72 rounded-lg" />
          <Skeleton className="h-3.5 w-96 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Navigator Strip Skeleton */}
      <div className="p-3 bg-card border border-border rounded-2xl flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-40 rounded-md" />
        <div className="flex items-center gap-1.5 overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="h-7 w-7 rounded-lg shrink-0" />
          ))}
        </div>
      </div>

      {/* Main 2-Column Surface Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 bg-card border border-border rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
            <div className="space-y-2 pt-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>

        {/* Right Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 bg-card border border-border rounded-2xl space-y-3">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="p-5 bg-card border border-border rounded-2xl space-y-3">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
