import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { User } from "@/types/api";

export const ME_KEY = ["auth", "me"] as const;

/** Resolves to the current user, or null when logged out (401). */
export function useMe() {
  return useQuery<User | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (e) {
        if (isApiError(e) && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.auth.login,
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
      toast.success(`Welcome back, ${user.full_name.split(" ")[0]}`);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.auth.register,
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
      toast.success("Account created");
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: api.auth.logout,
    // Hard navigation wipes every cached query so no data leaks to the next user.
    onSettled: () => window.location.assign("/login"),
  });
}