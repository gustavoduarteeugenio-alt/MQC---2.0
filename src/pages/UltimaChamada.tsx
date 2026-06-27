import { Button } from "@/components/ui/button";
import {
  Flame,
  Target,
  Filter,
  Timer,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";

const KIWI_URL = "https://pay.kiwify.com.br/5kq1jdL";

const UltimaChamada = () => {
  return (
    <div className="min-h-screen bg-gradient-night text-white">
      {/* HERO */}
      <header className="relative px-5 pt-14 pb-12 overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="max-w-2xl mx-auto text-center relative">

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-flame shadow-flame mb-5">
            <Flame className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-bold leading-[1.05]">
            Última chamada para fazer parte do{" "}
            <span className="text-primary">Método Questão Certa CFSd BM</span>.
          </h1>

          <p className="text-base sm:text-lg text-white/80 mt-5 max-w-xl mx-auto leading-relaxed">
            Pare de se perder em materiais genéricos nesta reta final. Estude
            através do método de engenharia reversa que identifica suas
            dificuldades exatas e vai te fazer chegar à aprovação.
          </p>

          <Button
            asChild
            className="w-full sm:w-auto h-14 mt-7 px-8 bg-gradient-flame text-white font-display text-base stencil shadow-flame hover:scale-[1.02] transition-transform"
          >
            <a href={KIWI_URL} target="_blank" rel="noopener noreferrer">
              QUERO SER APROVADO NO CFSd BM
              <ChevronRight className="w-5 h-5 ml-1" />
            </a>
          </Button>
        </div>
      </header>

      {/* MÉTODO */}
      <section className="px-5 py-12 bg-black/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-center leading-tight">
            Como o Método Questão Certa vai te levar aos{" "}
            <span className="text-primary">80% de acerto</span>?
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <article className="bg-card/60 backdrop-blur border border-border/40 rounded-2xl p-6 text-left">
              <div className="w-11 h-11 rounded-xl bg-gradient-flame flex items-center justify-center shadow-flame mb-4">
                <Target className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display font-bold text-base leading-snug">
                Mapeamento de Dificuldades
              </h3>
              <p className="text-sm text-white/70 mt-2 leading-relaxed">
                O aplicativo não é só um banco estático. Ele analisa seus erros
                e te diz exatamente qual das 6 matérias do edital você precisa
                revisar.
              </p>
            </article>

            <article className="bg-card/60 backdrop-blur border border-border/40 rounded-2xl p-6 text-left">
              <div className="w-11 h-11 rounded-xl bg-gradient-flame flex items-center justify-center shadow-flame mb-4">
                <Filter className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display font-bold text-base leading-snug">
                Filtro Vertical IDECAN
              </h3>
              <p className="text-sm text-white/70 mt-2 leading-relaxed">
                Questões focadas estritamente no edital de Minas Gerais
                (incluindo Proteção e Defesa Civil).
              </p>
            </article>

            <article className="bg-card/60 backdrop-blur border border-border/40 rounded-2xl p-6 text-left">
              <div className="w-11 h-11 rounded-xl bg-gradient-flame flex items-center justify-center shadow-flame mb-4">
                <Timer className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display font-bold text-base leading-snug">
                Ambiente de Combate
              </h3>
              <p className="text-sm text-white/70 mt-2 leading-relaxed">
                Simulados inéditos com cronômetro para treinar o seu tempo de
                prova.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* OFERTA */}
      <section className="px-5 py-14">
        <div className="max-w-md mx-auto">
          <div className="relative bg-gradient-to-b from-card/90 to-card/50 border-2 border-primary rounded-3xl p-7 sm:p-9 shadow-flame">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-4 py-1.5 rounded-full text-[10px] stencil font-bold flex items-center gap-1.5 whitespace-nowrap shadow-card">
              <AlertTriangle className="w-3 h-3" />
              OFERTA EXCLUSIVA DE RETA FINAL
            </div>

            <div className="text-center mt-2">
              <p className="stencil text-[11px] text-white/60 tracking-widest">
                ACESSO PREMIUM COMPLETO
              </p>
              <div className="mt-3 flex items-end justify-center gap-1">
                <span className="text-2xl font-display text-white/70 mb-2">
                  R$
                </span>
                <span className="text-6xl sm:text-7xl font-display font-bold text-primary leading-none">
                  97,00
                </span>
              </div>
              <p className="text-xs text-white/60 mt-2">
                Valor único · Sem mensalidades · Sem pegadinhas
              </p>
            </div>

            <div className="mt-6 bg-warning/15 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-white/85 leading-relaxed">
                Seu acesso Premium estará garantido e{" "}
                <strong className="text-warning">100% ativo</strong> até o dia
                da prova do CBMMG.
              </p>
            </div>

            <ul className="mt-6 space-y-2.5">
              {[
                "Banco completo de questões IDECAN",
                "Diagnóstico automatizado por matéria",
                "Simulados cronometrados",
                "Gabarito comentado em todas as questões",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 text-sm text-white/85"
                >
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <Button
              asChild
              className="w-full h-14 mt-7 bg-gradient-flame text-white font-display text-base stencil shadow-flame hover:scale-[1.02] transition-transform"
            >
              <a href={KIWI_URL} target="_blank" rel="noopener noreferrer">
                QUERO SER APROVADO NO CFSd BM
                <ChevronRight className="w-5 h-5 ml-1" />
              </a>
            </Button>

            <p className="text-[11px] text-white/50 text-center mt-4 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" />
              Pagamento 100% seguro via Kiwify
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-5 pb-8 text-center">
        <p className="text-[11px] text-white/40">
          Questão Certa CBMMG — Método focado no edital de Minas Gerais.
        </p>
      </footer>

      {/* CTA MOBILE FIXO */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur border-t border-border/40 z-40">
        <Button
          asChild
          className="w-full h-12 bg-gradient-flame text-white font-display stencil shadow-flame"
        >
          <a href={KIWI_URL} target="_blank" rel="noopener noreferrer">
            GARANTIR POR R$ 97,00
            <ChevronRight className="w-4 h-4 ml-1" />
          </a>
        </Button>
      </div>
      <div className="sm:hidden h-20" />
    </div>
  );
};

export default UltimaChamada;
