import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PlanType = "basic" | "premium" | "monthly" | "quarterly";

export type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan: PlanType;
  premium_until: string | null;
  premium_since: string | null;
  trial_started_at: string | null;
  onboarding_completed_at: string | null;
};

export const TRIAL_DAYS = 5;

const BASIC_DAILY_LIMIT = 5;

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
    let prof = p as Profile | null;
    // Auto-expire on login: if premium_until passed, downgrade in DB
    if (
      prof &&
      (prof.plan === "premium" || prof.plan === "monthly" || prof.plan === "quarterly") &&
      prof.premium_until &&
      new Date(prof.premium_until) < new Date()
    ) {
      await supabase
        .from("profiles")
        .update({ plan: "basic" as any, premium_until: null, premium_since: null } as any)
        .eq("user_id", user.id);
      prof = { ...prof, plan: "basic", premium_until: null, premium_since: null };
    }
    setProfile(prof);
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

  const planIsPremium = profile?.plan === "premium" || profile?.plan === "monthly" || profile?.plan === "quarterly";
  const notExpired = !profile?.premium_until || new Date(profile.premium_until) > new Date();
  const isPremium = !!planIsPremium && notExpired;

  // Trial calculation
  const trialStartedAt = profile?.trial_started_at ? new Date(profile.trial_started_at) : null;
  const trialEndsAt = trialStartedAt ? new Date(trialStartedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : null;
  const trialActive = !!trialEndsAt && trialEndsAt > new Date();
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const hasAccess = isPremium || trialActive || isAdmin || isDidacticAdmin;

  const dailyLimit = isPremium || trialActive ? Infinity : BASIC_DAILY_LIMIT;
  const canAnswerMore = dailyCount < dailyLimit;

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

  return { profile, dailyCount, dailyLimit, isPremium, isAdmin, isDidacticAdmin, canAnswerMore, loading, refresh, incrementDaily };
};
