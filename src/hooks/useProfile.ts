import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { hasActiveAccess, isAccessExpired } from "@/lib/access";

export type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  approved: boolean;
  access_until: string | null;
  onboarding_completed_at: string | null;
};

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dailyCount, setDailyCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDidacticAdmin, setIsDidacticAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setProfile(null);
      setDailyCount(0);
      setIsAdmin(false);
      setIsDidacticAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: p }, { data: u }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("daily_usage").select("questions_count").eq("user_id", user.id).eq("usage_date", today).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    // access_until entra nos types gerados só depois que a migration for aplicada
    setProfile(p as unknown as Profile | null);
    setDailyCount(u?.questions_count ?? 0);
    const rolesArr = (roles ?? []).map((r: any) => r.role);
    setIsAdmin(rolesArr.includes("admin"));
    setIsDidacticAdmin(rolesArr.includes("admin_didatico"));
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Acesso ao app: compra aprovada na Hotmart (ou liberação manual), dentro do prazo de 1 ano.
  const hasAccess = hasActiveAccess(profile) || isAdmin || isDidacticAdmin;
  const accessExpired = isAccessExpired(profile);

  const incrementDaily = async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = dailyCount + 1;
    setDailyCount(next);
    // upsert
    const { data: existing } = await supabase
      .from("daily_usage")
      .select("id")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();
    if (existing) {
      await supabase.from("daily_usage").update({ questions_count: next }).eq("id", existing.id);
    } else {
      await supabase.from("daily_usage").insert({ user_id: user.id, usage_date: today, questions_count: next });
    }
  };

  return { profile, dailyCount, isAdmin, isDidacticAdmin, loading, refresh, incrementDaily, hasAccess, accessExpired };
};
