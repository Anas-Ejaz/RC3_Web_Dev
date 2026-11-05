import Link from "next/link";
import { Accent } from "@/components/brand";
import { MatchPreview } from "@/components/landing/match-preview";
import { PublicNav } from "@/components/landing/public-nav";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="p-3">
      <div className="overflow-hidden rounded-3xl bg-forest-hero text-cream-50">
        <PublicNav />

        <div className="container max-w-4xl pb-12 pt-14 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-cream-50/20 bg-cream-50/10 px-3 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden />
            AI recommends. Humans decide.
          </span>
          <h1 className="mt-6 text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Hire on evidence, not <Accent>guesswork</Accent>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-cream-50/70">
            Upload resumes, get explainable match scores that quote the exact lines behind every skill, and keep the final call where it belongs: with you.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="light" size="lg">
              <Link href="/register?role=candidate&next=/candidate/jobs">Find Jobs</Link>
            </Button>
            <Button asChild variant="lime" size="lg">
              <Link href="/register?role=recruiter&next=/recruiter/jobs/new">Post a Job</Link>
            </Button>
          </div>
        </div>

        <div className="container pb-8">
          <MatchPreview />
        </div>
      </div>
    </section>
  );
}