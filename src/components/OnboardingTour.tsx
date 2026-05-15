import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Flame, BookOpen, BarChart3, ShieldCheck, Radio, ChevronRight } from "lucide-react";

const STEPS = [
  {
    icon: Flame,
    title: "Bem-vindo, Combatente!",
    body: "A partir de agora, você inicia uma jornada individualizada. Nosso sistema analisará cada resposta sua para oferecer um direcionamento preciso, apontando exatamente quais pontos você deve priorizar para garantir seu melhor rendimento e a sua farda no CBMMG.",
  },
  {
    icon: BookOpen,
    title: "Como responder questões",
    body: "Acesse 'Matérias' no menu, escolha uma disciplina do edital e enfrente cada questão com calma. Após responder, leia o gabarito comentado — é nele que está o aprendizado.",
  },
  {
    icon: BarChart3,
    title: "Feedback de desempenho",
    body: "Na aba 'Progresso' você vê seu Índice de Vulnerabilidade por matéria, identifica seus pontos fracos e recebe orientação do Mentor de Estudos para focar onde mais importa.",
  },
  {
    icon: ShieldCheck,
    title: "Simulados completos",
    body: "Os simulados reproduzem o estilo IDECAN, com tempo cronometrado e relatório por disciplina. Use-os para medir sua prontidão real para a prova.",
  },
  {
    icon: Radio,
    title: "Canal direto com a Sala de Comando",
    body: "Precisa de ajuda, encontrou um erro em alguma questão ou tem uma sugestão? Vá em 'Perfil' → 'Suporte e Sugestões', escolha o tipo de mensagem (Dúvida Técnica, Erro em Questão, Sugestão de Melhoria ou Outros), descreva sua demanda e envie. Nossa equipe responderá o quanto antes.",
  },
];

export const OnboardingTour = () => {
  const { user } = useAuth();
  const { profile, loading, refresh, isPremium } = useProfile();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading && profile && !profile.onboarding_completed_at) {
      setStep(0);
      setOpen(true);
    }
  }, [loading, profile?.onboarding_completed_at]);

  const finish = async () => {
    setOpen(false);
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("user_id", user.id);
      refresh();
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-border">
        <div className="bg-gradient-night text-white px-6 pt-6 pb-5 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-flame shadow-flame mb-3">
            <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <p className="stencil text-[10px] text-primary">
            Passo {step + 1} de {STEPS.length}
          </p>
          <h2 className="font-display text-xl font-bold mt-1">{current.title}</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-foreground/80 leading-relaxed">{current.body}</p>
          {isFirst && (
            <div className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-foreground">
              <strong className="stencil text-warning-foreground">Teste grátis ativo:</strong> 5 dias de acesso total a todas as funcionalidades. Aproveite cada minuto.
            </div>
          )}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={finish}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Pular tutorial
            </button>
            <Button onClick={next} className="bg-gradient-flame text-white font-display stencil">
              {isLast ? "Começar" : "Continuar"} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
