import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Crown, Sparkles, Flame } from "lucide-react";
import { ReactNode } from "react";

const BENEFITS = [
  "Acesso total ao banco de questões IDECAN",
  "Gabaritos comentados",
  "Metas semanais",
  "Simulados ilimitados",
];

const MONTHLY_URL = "https://pay.kiwify.com.br/PMLV49m";
const EXAM_URL = "https://pay.kiwify.com.br/5kq1jdL";

interface PlanSelectionDialogProps {
  children: ReactNode;
}

export const PlanSelectionDialog = ({ children }: PlanSelectionDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md sm:max-w-2xl p-0 overflow-hidden bg-card border-border">
        <div className="bg-gradient-night text-white px-6 pt-6 pb-5">
          <DialogHeader>
            <div className="flex items-center justify-center gap-2">
              <Crown className="w-6 h-6 text-warning" />
              <DialogTitle className="font-display text-xl text-white">Escolha seu plano Premium</DialogTitle>
            </div>
            <DialogDescription className="text-white/70 text-center text-xs">
              Treine sem limites e domine o edital do CFSD.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 py-5 grid gap-4 sm:grid-cols-2 bg-background">
          {/* Até o dia da prova */}
          <article className="relative bg-gradient-flame text-white rounded-2xl p-5 shadow-flame flex flex-col">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-3 py-1 rounded-full text-[10px] stencil font-bold flex items-center gap-1 shadow-card whitespace-nowrap">
              <Sparkles className="w-3 h-3" /> Melhor escolha
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <p className="stencil text-[11px] font-bold">Até o dia da prova</p>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold">R$ 79,90</span>
            </div>
            <p className="text-[10px] opacity-90 mt-0.5">Em até 2x de R$ 39,95 sem juros</p>
            <div className="mt-3 rounded-lg bg-warning/95 text-warning-foreground px-3 py-2 shadow-card ring-2 ring-warning/60 animate-pulse">
              <p className="text-sm font-extrabold uppercase tracking-wide text-center leading-tight">
                ⚡ Acesso garantido até a prova!
              </p>
            </div>
            <ul className="mt-3 space-y-2 text-xs flex-1">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="w-full mt-5 bg-white text-primary hover:bg-white/90 font-display stencil"
            >
              <a href={KIWIFY_URL} target="_blank" rel="noopener noreferrer">
                Garantir acesso
              </a>
            </Button>
          </article>

          {/* Mensal */}
          <article className="relative bg-card border-2 border-secondary/30 rounded-2xl p-5 shadow-card flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-secondary" />
              </div>
              <p className="stencil text-[11px] text-secondary font-bold">Plano Mensal</p>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold text-foreground">R$ 49,90</span>
              <span className="text-xs text-muted-foreground">/mês</span>
            </div>
            <ul className="mt-4 space-y-2 text-xs flex-1">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-success" />
                  <span className="text-foreground">{b}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="w-full mt-5 bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display stencil"
            >
              <a href={KIWIFY_URL} target="_blank" rel="noopener noreferrer">
                Assinar mensal
              </a>
            </Button>
          </article>

        </div>

        <p className="text-[10px] text-muted-foreground text-center pb-4 px-5">
          Pagamento processado com segurança pela Kiwify. Cancele quando quiser.
        </p>
      </DialogContent>
    </Dialog>
  );
};
