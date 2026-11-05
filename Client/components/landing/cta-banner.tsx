import Link from "next/link";
import { Accent } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function CtaBanner() {
  return (
    <section className="p-3">
      <div className="rounded-3xl bg-forest-hero px-6 py-20 text-center text-cream-50 sm:py-28">
        <h2 className="mx-auto max-w-2xl text-4xl font-medium leading-tight tracking-tight sm:text-6xl">
          Ready to hire <Accent>smarter today?</Accent>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-cream-50/70">
          Post a role or find your next one. Every score comes with its evidence.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="light" size="lg">
            <Link href="/register?role=candidate&next=/candidate/jobs">Find Jobs</Link>
          </Button>
          <Button asChild variant="outlineLight" size="lg">
            <Link href="/register?role=recruiter&next=/recruiter/jobs/new">Post a Job</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}