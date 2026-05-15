import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { LogOut, Mail, Crown, Calendar, Zap, Shield, ChevronRight, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { PlanSelectionDialog } from "@/components/PlanSelectionDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const planLabel = (plan?: string | null) => {
  switch (plan) {
    case "monthly": return "Mensal";
    case "quarterly": return "Trimestral";
    case "premium": return "Premium";
    default: return "Básico";
  }
};

const Profile = () => {
  const { signOut, user } = useAuth();
  const { profile, isPremium, isAdmin, dailyCount, dailyLimit, refresh } = useProfile();

  const replayTutorial = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ onboarding_completed_at: null }).eq("user_id", user.id);
    await refresh();
    toast({ title: "Tutorial reiniciado", description: "Bem-vindo de volta, combatente!" });
  };

  const initials = (profile?.full_name ?? user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <header className="bg-gradient-night text-white px-5 pt-12 pb-16 rounded-b-[2rem] text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-flame flex items-center justify-center font-display text-2xl font-bold shadow-flame">
          {initials}
        </div>
        <h1 className="font-display text-xl font-bold mt-3">{profile?.full_name ?? "Recruta"}</h1>
        <p className="text-xs text-white/70">{profile?.email ?? user?.email}</p>
        <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs stencil ${isPremium ? "bg-warning text-warning-foreground" : "bg-white/10"}`}>
          <Crown className="w-3.5 h-3.5" /> {planLabel(profile?.plan)}
        </div>
        {isPremium && profile?.premium_until && (
          <p className="mt-2 text-[11px] text-white/80">
            Válido até {new Date(profile.premium_until).toLocaleDateString("pt-BR")}
          </p>
        )}
      </header>

      <main className="px-5 -mt-10 space-y-3 relative">
        <Card>
          <Row icon={Mail} label="E-mail" value={profile?.email ?? user?.email ?? "—"} />
          <Row icon={Crown} label="Plano" value={planLabel(profile?.plan)} />
          {profile?.premium_until && (
            <Row icon={Calendar} label="Premium até" value={new Date(profile.premium_until).toLocaleDateString("pt-BR")} />
          )}
          <Row icon={Zap} label="Questões hoje" value={isPremium ? `${dailyCount} (ilimitado)` : `${dailyCount} / ${dailyLimit}`} />
        </Card>

        {!isPremium && (
          <PlanSelectionDialog>
            <button className="w-full text-left">
              <Card className="bg-gradient-flame text-white shadow-flame">
                <div className="flex items-center justify-between p-1">
                  <div>
                    <p className="stencil text-[11px] opacity-90">Upgrade</p>
                    <p className="font-display font-bold">Tornar-se Premium</p>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </div>
              </Card>
            </button>
          </PlanSelectionDialog>
        )}

        {isAdmin && (
          <Link to="/admin">
            <Card>
              <div className="flex items-center justify-between p-1">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-secondary" />
                  <p className="font-display font-semibold">Painel administrativo</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        )}

        <Button onClick={signOut} variant="outline" className="w-full mt-2 stencil">
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </Button>
      </main>
    </AppShell>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card border border-border rounded-2xl p-4 shadow-card ${className}`}>{children}</div>
);

const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-3 py-2">
    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="stencil text-[10px] text-muted-foreground">{label}</p>
      <p className="font-display font-semibold text-sm truncate">{value}</p>
    </div>
  </div>
);

export default Profile;
