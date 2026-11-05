"use client";

import { Briefcase, CalendarClock, LayoutDashboard, Menu, ShieldCheck, Users } from "lucide-react";
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
  { href: "/recruiter/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/recruiter/jobs", label: "Jobs", Icon: Briefcase },
  { href: "/recruiter/interviews", label: "Interviews", Icon: CalendarClock },
  { href: "/recruiter/talent", label: "Talent intelligence", Icon: Users },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col p-6 text-cream-50">
      <Logo href="/recruiter/dashboard" />
      <nav aria-label="Recruiter" className="mt-10 flex-1">
        <ul className="space-y-1.5">
          {LINKS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-lime text-forest-900" : "text-cream-50/80 hover:bg-cream-50/10 hover:text-cream-50",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="rounded-2xl bg-cream-50/10 p-4 text-sm text-cream-50/80">
        <ShieldCheck className="mb-2 h-5 w-5 text-lime" aria-hidden />
        Human in the loop. AI scores support your decision; they never make it.
      </div>
    </div>
  );
}

export function RecruiterShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen p-3 lg:block">
        <div className="h-full overflow-y-auto rounded-3xl bg-forest-hero">
          <SidebarContent />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/85 px-5 backdrop-blur lg:px-10">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined} className="w-72 border-forest-700 bg-forest-900 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="ml-auto flex items-center gap-2">
            <UserMenu />
          </div>
        </header>
        <main className="px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}