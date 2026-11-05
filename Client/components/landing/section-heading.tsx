import { Accent } from "@/components/brand";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  chip: string;
  title: string;
  accent?: string;
  description?: string;
  className?: string;
}

export function SectionHeading({ chip, title, accent, description, className }: SectionHeadingProps) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-lime-dark" aria-hidden />
        {chip}
      </span>
      <h2 className="mt-5 text-4xl font-medium tracking-tight sm:text-5xl">
        {title} {accent && <Accent>{accent}</Accent>}
      </h2>
      {description && <p className="mt-4 text-muted-foreground">{description}</p>}
    </div>
  );
}