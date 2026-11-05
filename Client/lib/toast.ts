import { toast } from "sonner";
import { isApiError } from "@/lib/api";

export function toastError(e: unknown, fallback = "Something went wrong") {
  toast.error(isApiError(e) ? e.message : fallback);
}

export { toast };