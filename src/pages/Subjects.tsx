import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ChevronRight } from "lucide-react";


type Subject = { id: string; name: string; slug: string; icon: string | null; questionCount?: number };

const Subjects = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: subs } = await supabase.from("subjects").select("*").order("display_order");
      const { data: counts } = await supabase.from("questions").select("subject_id");
      const counted: Record<string, number> = {};
      (counts ?? []).forEach((q: any) => { counted[q.subject_id] = (counted[q.subject_id] ?? 0) + 1; });
      setSubjects((subs ?? []).map((s: any) => ({ ...s, questionCount: counted[s.id] ?? 0 })));
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell>
      <header className="px-5 pt-12 pb-5 bg-gradient-night text-white">
        <p className="stencil text-xs text-primary">Edital CBMMG 2027</p>
        <h1 className="text-2xl font-display font-bold">Matérias</h1>
        <p className="text-sm text-white/70 mt-1">Selecione uma frente de batalha.</p>
      </header>

      <main className="px-5 py-5 space-y-3">
        <AdBanner className="mb-1" />
        {loading ? (
          <p className="text-center text-muted-foreground py-10">Carregando...</p>
        ) : (
          subjects.map((s) => {
            const Icon = (LucideIcons as any)[s.icon ?? "BookOpen"] ?? LucideIcons.BookOpen;
            const disabled = s.questionCount === 0;
            return (
              <Link key={s.id} to={disabled ? "#" : `/questao/${s.slug}`}
                className={`flex items-center gap-3 bg-card border border-border rounded-2xl p-4 shadow-card transition-all ${disabled ? "opacity-50 pointer-events-none" : "active:scale-[0.98] hover:border-primary/50"}`}>
                <div className="w-12 h-12 rounded-xl bg-gradient-flame flex items-center justify-center shadow-flame">
                  <Icon className="w-6 h-6 text-white" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold leading-tight">{s.name}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            );
          })
        )}
      </main>
    </AppShell>
  );
};

export default Subjects;
