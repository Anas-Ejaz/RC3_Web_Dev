"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMe } from "@/hooks/use-auth";
import { homeFor } from "@/lib/routes";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#jobs", label: "Find jobs" },
  { href: "/#faq", label: "FAQ" },
];

export function PublicNav() {
  const { data: user } = useMe();
  const [open, setOpen] = useState(false);

  return (
    <nav aria-label="Main" className="flex items-center justify-between px-5 py-5 sm:px-8">
      <Logo />

      <ul className="hidden items-center gap-8 text-sm text-cream-50/80 md:flex">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="rounded transition-colors hover:text-cream-50">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        {user ? (
          <Button asChild variant="lime">
            <Link href={homeFor(user.role)}>Go to dashboard</Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="ghost" className="hidden text-cream-50 hover:bg-cream-50/10 hover:text-cream-50 sm:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild variant="lime">
              <Link href="/register">Get started</Link>
            </Button>
          </>
        )}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-cream-50 hover:bg-cream-50/10 hover:text-cream-50 md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" aria-describedby={undefined} className="w-72 border-forest-700 bg-forest-900 text-cream-50">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <ul className="mt-10 space-y-1">
              {[...LINKS, ...(user ? [] : [{ href: "/login", label: "Log in" }])].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-3 text-sm font-medium text-cream-50/80 hover:bg-cream-50/10 hover:text-cream-50"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}