"use client";

import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout, useMe } from "@/hooks/use-auth";
import { cn, initials } from "@/lib/utils";

export function UserMenu({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { data: user } = useMe();
  const logout = useLogout();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            "flex items-center gap-2 rounded-full p-1 pr-3 text-sm font-medium transition-colors",
            tone === "dark" ? "text-cream-50 hover:bg-cream-50/10" : "hover:bg-accent",
          )}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-lime text-xs font-semibold text-forest-900">
            {initials(user.full_name)}
          </span>
          <span className="hidden sm:inline">{user.full_name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-2xl">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium">{user.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs capitalize text-muted-foreground">{user.role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}