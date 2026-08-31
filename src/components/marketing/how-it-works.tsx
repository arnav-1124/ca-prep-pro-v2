export function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Create Your Account",
      description: "Create your student account and get started with your preparation.",
    },
    {
      number: "02",
      title: "Choose Your CA Attempt",
      description: "Select your active CA study level and target exam attempt window.",
    },
    {
      number: "03",
      title: "Practice & Track",
      description: "Work through Assessments, review explanations, and log progress stats.",
    },
    {
      number: "04",
      title: "Advanced Study Tools",
      description: "Unlock advanced study modules and preparation tools when you need them.",
    },
  ];

  return (
    <section className="py-20 bg-muted/40 border-y border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-muted-foreground">
            A direct, clear workflow structured around regular practice habits and structured learning progress.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((st) => (
            <div key={st.number} className="relative">
              <div className="text-5xl font-extrabold text-primary/20 mb-4">{st.number}</div>
              <h3 className="text-lg font-bold text-foreground mb-2">{st.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{st.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
