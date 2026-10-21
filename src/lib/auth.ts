import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "./inventory";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc("bootstrap_user");
      if (error) throw error;
      return {
        email: u.user?.email ?? "",
        id: u.user?.id ?? "",
        role: (data ?? null) as Role | null,
      };
    },
  });
}

export function usePermissions() {
  const { data } = useMe();
  const role = data?.role;
  return {
    role,
    isAdmin: role === "admin",
    canOperate: role === "admin" || role === "warehouse",
  };
}
