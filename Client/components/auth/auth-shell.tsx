import { FileSearch, Scale, UserCheck } from "lucide-react";
import { Accent, Logo } from "@/components/brand";
import { ScoreCard } from "@/components/shared/score-card";

const POINTS = [
  { Icon: FileSearch, text: "Every score links back to the exact resume line it came from." },
  { Icon: Scale, text: "Missing evidence is flagged for review, never counted as a failing." },
  { Icon: UserCheck, text: "AI recommends. You decide, and every decision is logged." },
];

interface AuthShellProps {
  title: string;
  accent: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthShell({ title, accent, subtitle, children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden p-3 lg:block">
        <div className="flex h-full flex-col justify-between gap-10 rounded-3xl bg-forest-hero p-10 text-cream-50">
          <Logo />
          <div>
            <h2 className="text-5xl font-medium leading-[1.1] tracking-tight">
              Decisions backed by <Accent>evidence</Accent>
            </h2>
            <ul className="mt-8 space-y-4">
              {POINTS.map(({ Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-cream-50/80">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime text-forest-900">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <ScoreCard variant="dark" score={92} label="Sample match" subtitle="Backend Developer" className="max-w-xs bg-cream-50/10" />
        </div>
      </aside>

      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="lg:hidden">
          <Logo variant="dark" />
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-10">
          <h1 className="text-4xl font-medium tracking-tight">
            {title} <Accent>{accent}</Accent>
          </h1>
          <p className="mb-8 mt-3 text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}