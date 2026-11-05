import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "@/lib/api";

/** Maps the contract's `fields` error map onto react-hook-form. Returns true if any field error was set. */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>): boolean {
  if (!isApiError(e) || !e.fields) return false;
  const entries = Object.entries(e.fields);
  entries.forEach(([name, message]) => setError(name as Path<T>, { type: "server", message }));
  return entries.length > 0;
}