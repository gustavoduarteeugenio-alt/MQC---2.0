import { Link } from "react-router-dom";
import { Crown, Check, Flame, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTHLY_URL = "https://pay.kiwify.com.br/PMLV49m";
const EXAM_URL = "https://pay.kiwify.com.br/5kq1jdL";

const BENEFITS = [
  "Acesso total ao banco de questões IDECAN",
  "Gabaritos comentados",
  "Simulados ilimitados",
  "Sem anúncios",
];

const SelecionarPlano = () => {
  return (
    <div className="min-h-screen bg-gradient-night text-white px-5 py-8 flex flex-col">
      <header className="text-center max-w-xl mx-auto">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-flame shadow-flame mb-3">
          <Flame className="w-7 h-7 text-white" strokeWidth={2.5} />
        </div>
        <p className="stencil text-xs text-primary">Bem-vindo, recruta</p>
        <h1 className="text-2xl sm:text-3xl font-display font-bold mt-1">Escolha como vai treinar</h1>
        <p className="text-sm text-white/70 mt-2 max-w-md mx-auto">
          Com o Método Questão Certa você acerta 80% das questões até o dia da prova.
        </p>
      </header>

      <main className="mt-8 grid gap-4 sm:grid-cols-2 max-w-3xl w-full mx-auto">
        {/* Até o dia da prova */}
        <article className="relative bg-gradient-flame text-white rounded-2xl p-6 shadow-flame flex flex-col">
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-warning text-warning-foreground px-3 py-1 rounded-full text-[10px] stencil font-bold flex items-center gap-1 shadow-card whitespace-nowrap">
            <Sparkles className="w-3 h-3" /> Melhor escolha
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <p className="stencil text-[11px] font-bold">Até o dia da prova</p>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold">R$ 79,90</span>
          </div>
          <p className="text-xs opacity-90 mt-0.5">Em até 2x de R$ 39,95 sem juros</p>
          <div className="mt-3 rounded-lg bg-warning/95 text-warning-foreground px-3 py-2 shadow-card">
            <p className="text-sm font-extrabold uppercase tracking-wide text-center leading-tight">
              ⚡ Acesso garantido até a prova
            </p>
          </div>
          <ul className="mt-3 space-y-2 text-sm flex-1">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Button asChild className="w-full mt-5 bg-white text-primary hover:bg-white/90 font-display stencil">
            <a href={KIWIFY_URL} target="_blank" rel="noopener noreferrer">Garantir acesso</a>
          </Button>
        </article>

        {/* Mensal */}
        <article className="relative bg-card border-2 border-secondary/30 rounded-2xl p-6 shadow-card flex flex-col text-foreground">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-secondary" />
            </div>
            <p className="stencil text-[11px] text-secondary font-bold">Plano Mensal</p>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold">R$ 49,90</span>
            <span className="text-xs text-muted-foreground">/mês</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Cancele quando quiser</p>
          <ul className="mt-4 space-y-2 text-sm flex-1">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-success" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Button asChild className="w-full mt-5 bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display stencil">
            <a href={KIWIFY_URL} target="_blank" rel="noopener noreferrer">Assinar mensal</a>
          </Button>
        </article>
      </main>

      <div className="mt-6 text-center">
        <Link to="/" className="text-sm text-white/60 hover:text-white underline-offset-4 hover:underline">
          Continuar sem plano
        </Link>
        <p className="text-[10px] text-white/40 mt-3">Pagamento processado com segurança pela Kiwify.</p>
      </div>
    </div>
  );
};

export default SelecionarPlano;
