import { Calendar, Flame } from "lucide-react";

export function ProductPreview() {
  return (
    <div className="border border-border bg-card text-card-foreground rounded-2xl shadow-md p-6 space-y-6 max-w-md mx-auto hover:shadow-lg transition-shadow">
      <div className="text-left border-b border-border pb-4 flex justify-between items-center">
        <div>
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
            Workspace Preview
          </span>
          <h4 className="text-base font-bold mt-2 text-foreground">Syllabus Practice Dashboard</h4>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Target</div>
          <div className="text-sm font-bold text-foreground">May 2027</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left Column: Progress Circle */}
        <div className="border border-border rounded-xl p-4 flex flex-col justify-between items-center text-center bg-muted/10">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Overall Progress</div>
          <div className="relative flex items-center justify-center my-3">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle cx="40" cy="40" r="34" className="stroke-border fill-none" strokeWidth="6" />
              <circle
                cx="40"
                cy="40"
                r="34"
                className="stroke-primary fill-none transition-all duration-1000"
                strokeWidth="6"
                strokeDasharray="213.6"
                strokeDashoffset="59.8"
              />
            </svg>
            <span className="absolute text-lg font-extrabold text-foreground">72%</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Syllabus Completion</div>
        </div>

        {/* Right Column: Streaks & Days */}
        <div className="space-y-3">
          {/* Days Left */}
          <div className="border border-border rounded-xl p-3 flex items-center gap-3 bg-muted/10">
            <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Days Left</div>
              <div className="text-sm font-extrabold text-foreground">124 Days</div>
            </div>
          </div>

          {/* Study Streak */}
          <div className="border border-border rounded-xl p-3 flex items-center gap-3 bg-muted/10">
            <Flame className="h-5 w-5 text-orange-500 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Study Streak</div>
              <div className="text-sm font-extrabold text-foreground">28 Days</div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Goal */}
      <div className="border border-border rounded-xl p-4 bg-muted/10">
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs font-bold text-foreground">Today&apos;s Practice Goal</div>
          <span className="text-xs text-muted-foreground font-semibold">35 / 50 questions</span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: "70%" }} />
        </div>
      </div>

      {/* Subject Progress */}
      <div className="space-y-3 border-t border-border pt-4">
        <div className="text-xs font-bold text-foreground text-left">Subject Completion</div>
        <div className="grid grid-cols-1 gap-2.5">
          {[
            { name: "Advanced Accounting", progress: 78 },
            { name: "Corporate Laws", progress: 64 },
            { name: "Taxation", progress: 69 },
            { name: "Cost & Management Accounting", progress: 73 },
          ].map((subj) => (
            <div key={subj.name} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground w-1/2 text-left truncate">{subj.name}</span>
              <div className="flex items-center gap-3 w-1/2 justify-end">
                <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden hidden sm:block">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${subj.progress}%` }} />
                </div>
                <span className="font-extrabold text-foreground w-8 text-right">{subj.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
