import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Trophy, Target, Flame as FlameIcon, TrendingUp } from "lucide-react";

type Row = { subject: string; total: number; correct: number; accuracy: number };

const Dashboard = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [overall, setOverall] = useState({ total: 0, correct: 0, streak: 0 });

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: subs } = await supabase.from("subjects").select("id, name").order("display_order");
      const { data: attempts } = await supabase.from("attempts")
        .select("question_id, is_correct, created_at, questions(subject_id)")
        .eq("user_id", user.id)
        .limit(2000);

      const bySubject: Record<string, { total: number; correct: number }> = {};
      (attempts ?? []).forEach((a: any) => {
        const sid = a.questions?.subject_id; if (!sid) return;
        bySubject[sid] = bySubject[sid] ?? { total: 0, correct: 0 };
        bySubject[sid].total++;
        if (a.is_correct) bySubject[sid].correct++;
      });

      const built: Row[] = (subs ?? []).map((s: any) => {
        const stat = bySubject[s.id] ?? { total: 0, correct: 0 };
        return {
          subject: s.name.length > 14 ? s.name.split(" ")[0] : s.name,
          total: stat.total,
          correct: stat.correct,
          accuracy: stat.total ? Math.round((stat.correct / stat.total) * 100) : 0,
        };
      });
      setRows(built);

      const total = (attempts ?? []).length;
      const correct = (attempts ?? []).filter((a: any) => a.is_correct).length;

      // streak (dias consecutivos respondendo)
      const days = new Set((attempts ?? []).map((a: any) => new Date(a.created_at).toISOString().slice(0, 10)));
      let streak = 0;
      const d = new Date();
      while (days.has(d.toISOString().slice(0, 10))) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
      setOverall({ total, correct, streak });
    })();
  }, [user]);

  const accuracy = overall.total ? Math.round((overall.correct / overall.total) * 100) : 0;

  return (
    <AppShell>
      <header className="bg-gradient-night text-white px-5 pt-12 pb-6">
        <p className="stencil text-xs text-primary">Quartel · Inteligência</p>
        <h1 className="text-2xl font-display font-bold">Seu progresso</h1>
        <p className="text-sm text-white/70 mt-1">Acompanhe sua evolução por matéria.</p>
      </header>

      <main className="px-5 py-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Target} label="Acerto" value={`${accuracy}%`} />
          <Stat icon={Trophy} label="Total" value={String(overall.total)} />
          <Stat icon={FlameIcon} label="Sequência" value={`${overall.streak}d`} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold">Acerto por matéria</h2>
          </div>
          {overall.total === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Responda algumas questões para ver seus dados aqui.
            </p>
          ) : (
            <div className="h-72 -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="subject" type="category" width={90}
                    tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any, _n, p: any) => [`${v}% (${p.payload.correct}/${p.payload.total})`, "Acerto"]}
                  />
                  <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                    {rows.map((r, i) => (
                      <Cell key={i} fill={r.accuracy >= 70 ? "hsl(var(--success))" : r.accuracy >= 40 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-2">
          <h2 className="font-display font-bold mb-2">Detalhes</h2>
          {rows.map((r) => (
            <div key={r.subject} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.subject}</span>
              <span className="font-display font-semibold">{r.correct}/{r.total} · {r.accuracy}%</span>
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
};

const Stat = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="bg-card border border-border rounded-2xl p-3 shadow-card">
    <Icon className="w-4 h-4 text-primary mb-1.5" />
    <p className="stencil text-[9px] text-muted-foreground">{label}</p>
    <p className="font-display text-lg font-bold leading-tight">{value}</p>
  </div>
);

export default Dashboard;
