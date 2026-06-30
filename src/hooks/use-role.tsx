import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AppRole = "admin" | "user";
export type ViewMode = "admin" | "user";

interface RoleContextValue {
  roles: AppRole[];
  isAdmin: boolean;
  loading: boolean;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  effectiveIsAdmin: boolean;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);
const STORAGE_KEY = "vdj.viewMode";

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewModeState] = useState<ViewMode>("admin");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as ViewMode | null;
    if (saved === "admin" || saved === "user") setViewModeState(saved);
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setRoles([]);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!active) return;
        setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const isAdmin = roles.includes("admin");

  const setViewMode = (v: ViewMode) => {
    setViewModeState(v);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, v);
  };

  return (
    <RoleContext.Provider
      value={{
        roles,
        isAdmin,
        loading,
        viewMode,
        setViewMode,
        effectiveIsAdmin: isAdmin && viewMode === "admin",
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole deve ser usado dentro de RoleProvider");
  return ctx;
}
