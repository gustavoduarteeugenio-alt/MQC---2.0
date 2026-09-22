import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { LogOut, Mail, Shield, ChevronRight, PlayCircle, Radio, Trophy, CalendarClock } from "lucide-react";
import { formatAccessDate } from "@/lib/access";
import { useExam } from "@/contexts/ExamContext";
import { examLabel } from "@/lib/exams";
import { GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const Profile = () => {
  const { signOut, user } = useAuth();
  const { profile, isAdmin, isDidacticAdmin, refresh } = useProfile();
  const { enrollments, exam, setExam } = useExam();
  const initialShow = (profile as any)?.show_in_ranking ?? true;
  const [showInRanking, setShowInRanking] = useState<boolean>(initialShow);
  const [rankingName, setRankingName] = useState<string>((profile as any)?.ranking_name ?? "");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setShowInRanking((profile as any)?.show_in_ranking ?? true);
    setRankingName((profile as any)?.ranking_name ?? "");
  }, [profile]);

  const saveRankingName = async () => {
    if (!user) return;
    const trimmed = rankingName.trim().slice(0, 40);
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ ranking_name: trimmed || null } as any)
      .eq("user_id", user.id);
    setSavingName(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nome no ranking atualizado", description: trimmed ? `Você aparecerá como "${trimmed}".` : "Voltaremos a usar seu nome completo." });
    refresh();
  };

  const toggleRanking = async (value: boolean) => {
    if (!user) return;
    setShowInRanking(value);
    const { error } = await supabase
      .from("profiles")
      .update({ show_in_ranking: value } as any)
      .eq("user_id", user.id);
    if (error) {
      setShowInRanking(!value);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: value ? "Nome visível no ranking" : "Você ficará anônimo",
      description: value ? "Seu nome aparecerá para outros candidatos." : "Seu nome aparecerá como 'Anônimo'.",
    });
    refresh();
  };

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
      </header>

      <main className="px-5 -mt-10 space-y-3 relative">
        <Card>
          <Row icon={Mail} label="E-mail" value={profile?.email ?? user?.email ?? "—"} />
          {profile?.access_until && (
            <Row icon={CalendarClock} label="Acesso até" value={formatAccessDate(profile.access_until)} />
          )}
        </Card>

        {enrollments.length > 0 && (
          <Card>
            <p className="stencil text-[10px] text-muted-foreground mb-2">Minhas matrículas</p>
            <div className="space-y-2">
              {enrollments.map(({ exam: e, access_until }) => {
                const ativo = exam?.id === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => setExam(e.id)}
                    className={`w-full text-left flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                      ativo ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <GraduationCap className={`w-5 h-5 shrink-0 ${ativo ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold truncate">{examLabel(e)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {access_until ? `Acesso até ${formatAccessDate(access_until)}` : "Acesso sem prazo"}
                      </p>
                    </div>
                    {ativo && <span className="stencil text-[10px] text-primary shrink-0">Ativo</span>}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {(isAdmin || isDidacticAdmin) && (
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

        <Link to="/suporte">
          <Card>
            <div className="flex items-center justify-between p-1">
              <div className="flex items-center gap-3">
                <Radio className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-display font-semibold">Suporte e Sugestões</p>
                  <p className="text-[11px] text-muted-foreground">Canal direto com a Sala de Comando</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>

        <Card>
          <div className="flex items-center justify-between p-1 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Trophy className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-display font-semibold">Exibir meu nome no Ranking</p>
                <p className="text-[11px] text-muted-foreground">
                  Se desativado, seu nome aparecerá como "Anônimo" (LGPD).
                </p>
              </div>
            </div>
            <Switch checked={showInRanking} onCheckedChange={toggleRanking} />
          </div>
          {showInRanking && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <label className="stencil text-[10px] text-muted-foreground">
                Nome exibido no ranking
              </label>
              <div className="flex gap-2">
                <Input
                  value={rankingName}
                  onChange={(e) => setRankingName(e.target.value)}
                  placeholder="Ex.: Recruta João"
                  maxLength={40}
                />
                <Button
                  size="sm"
                  onClick={saveRankingName}
                  disabled={savingName || rankingName === ((profile as any)?.ranking_name ?? "")}
                >
                  Salvar
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Deixe em branco para usar seu nome completo. Máx. 40 caracteres.
              </p>
            </div>
          )}
        </Card>

        <button onClick={replayTutorial} className="w-full text-left">
          <Card>
            <div className="flex items-center justify-between p-1">
              <div className="flex items-center gap-3">
                <PlayCircle className="w-5 h-5 text-primary" />
                <p className="font-display font-semibold">Rever tutorial de boas-vindas</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        </button>

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
