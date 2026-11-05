import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand";

const EXPLORE = [
  { href: "/", label: "Home" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#jobs", label: "Find jobs" },
  { href: "/#faq", label: "FAQ" },
];

const ACCOUNT = [
  { href: "/login", label: "Log in" },
  { href: "/register", label: "Create account" },
  { href: "/register?role=recruiter&next=/recruiter/jobs/new", label: "Post a job" },
];

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-2xl font-medium">{title}</h2>
      <ul className="mt-6">
        {links.map((l) => (
          <li key={l.label} className="border-b">
            <Link href={l.href} className="flex items-center justify-between py-4 text-sm hover:text-muted-foreground">
              {l.label}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="container pb-6 pt-16">
      <div className="grid gap-10 md:grid-cols-[1fr_1fr_1.1fr]">
        <FooterColumn title="Explore" links={EXPLORE} />
        <FooterColumn title="Account" links={ACCOUNT} />
        <div>
          <Logo variant="dark" />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Explainable candidate matching. AI recommends, humans decide.
          </p>
        </div>
      </div>

      <div className="overflow-hidden" aria-hidden>
        <p className="mt-14 select-none text-center text-[clamp(4rem,19vw,17rem)] font-semibold leading-none tracking-tighter text-forest-900">
          Talentra
        </p>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">© {new Date().getFullYear()} Talentra. All rights reserved.</p>
    </footer>
  );
}