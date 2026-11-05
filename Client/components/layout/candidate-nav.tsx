"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isActive } from "@/lib/routes";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/candidate/dashboard", label: "Dashboard" },
  { href: "/candidate/jobs", label: "Jobs" },
  { href: "/candidate/recommended", label: "Recommended" },
  { href: "/candidate/applications", label: "Applications" },
  { href: "/candidate/profile", label: "Profile" },
];

export function CandidateNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 p-3">
      <nav aria-label="Main" className="flex items-center justify-between rounded-2xl bg-forest-900 px-4 py-3 text-cream-50 shadow-card sm:px-6">
        <div className="flex items-center gap-8">
          <Logo href="/candidate/dashboard" />
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3.5 py-2 text-sm transition-colors",
                      active ? "text-lime" : "text-cream-50/80 hover:text-cream-50",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-1">
          <UserMenu tone="dark" />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-cream-50 hover:bg-cream-50/10 hover:text-cream-50 md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined} className="w-72 border-forest-700 bg-forest-900 text-cream-50">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="mt-6">
                <Logo href="/candidate/dashboard" />
              </div>
              <ul className="mt-8 space-y-1">
                {LINKS.map((l) => {
                  const active = isActive(pathname, l.href);
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "block rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                          active ? "bg-lime text-forest-900" : "text-cream-50/80 hover:bg-cream-50/10",
                        )}
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}