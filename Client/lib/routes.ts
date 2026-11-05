import type { Role } from "@/types/api";

export function homeFor(role: Role) {
  return role === "recruiter" ? "/recruiter/dashboard" : "/candidate/dashboard";
}

/** Only follow ?next= when it points inside the user's own area; otherwise go home. */
export function safeNext(next: string | null, role: Role) {
  if (next && (next === `/${role}` || next.startsWith(`/${role}/`))) return next;
  return homeFor(role);
}

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}