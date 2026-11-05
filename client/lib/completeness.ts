import type { ParsedResume } from "@/types/api";

export interface ProfileLike {
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
  interests?: string[] | null;
}

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export interface Completeness {
  percent: number;
  items: CompletenessItem[];
}

const PROFILE_HREF = "/candidate/profile";
const RESUME_HREF = "/candidate/profile/resume";

const filled = (value?: string | null) => Boolean(value && value.trim());

export function getCompleteness(
  profile: ProfileLike | undefined,
  resume: ParsedResume | null | undefined,
): Completeness {
  const items: CompletenessItem[] = [
    { key: "headline", label: "Headline", done: filled(profile?.headline), href: PROFILE_HREF },
    { key: "phone", label: "Phone number", done: filled(profile?.phone), href: PROFILE_HREF },
    { key: "location", label: "Location", done: filled(profile?.location), href: PROFILE_HREF },
    { key: "summary", label: "Summary", done: filled(profile?.summary), href: PROFILE_HREF },
    { key: "interests", label: "At least one interest", done: (profile?.interests?.length ?? 0) > 0, href: PROFILE_HREF },
    { key: "resume", label: "Resume uploaded and read", done: resume?.parse_status === "parsed", href: RESUME_HREF },
  ];
  const doneCount = items.filter((item) => item.done).length;
  return { percent: Math.round((doneCount / items.length) * 100), items };
}