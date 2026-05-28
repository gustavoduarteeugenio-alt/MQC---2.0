import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Flame,
  Target,
  MapPin,
  Timer,
  ChevronRight,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Lock,
} from "lucide-react";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: z.string().trim().min(10, "Informe um telefone válido").max(30),
  instagram: z.string().trim().min(2, "Informe seu @ do Instagram").max(40),
});

const KIWI_URL = "https://pay.kiwify.com.br/PMLV49m";

const LandingPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = leadSchema.safeParse({
      name,
      email,
      phone,
      instagram: instagram.replace(/^@/, ""),
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0]] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("landing_leads").insert({
        name: result.data.name,
        email: result.data.email,
        phone: result.data.phone,
        instagram_handle: result.data.instagram,
        source: "reta-final-cbmmg",
      });

      if (error) {
        toast.error("Erro ao enviar. Tente novamente.");
        return;
      }

      setSubmitted(true);
      toast.success("Dados enviados com sucesso!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-night text-white">
      {/* ========== HERO ========== */}
      <header className="relative px-5 pt-12 pb-10 overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        </div>

        <div className="max-w-xl mx-auto text-center relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-flame shadow-flame mb-5">
            <Flame className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <p className="stencil text-[10px] text-primary tracking-widest uppercase mb-3">
            Concurso CBMMG — Edital 2025
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold leading-tight">
            Método de estudo que te faz acertar até{" "}
            <span className="text-primary">80% da prova</span>.
          </h1>
          <p className="text-sm text-white/75 mt-4 max-w-md mx-auto leading-relaxed">
            Pare de perder tempo com questões aleatórias. Estude através do
            método que identifica suas dificuldades e vai te fazer chegar à
            aprovação.
          </p>
        </div>
      </header>

      {/* ========== FUNCIONALIDADES ========== */}
      <section className="px-5 pb-10">
        <div className="max-w-xl mx-auto grid gap-4 sm:grid-cols-3">
          {/* Card 1 */}
          <article className="relative bg-card/60 backdrop-blur border border-border/40 rounded-2xl p-5 text-left">
            <div className="w-10 h-10 rounded-xl bg-gradient-flame flex items-center justify-center shadow-flame mb-3">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-display font-bold text-sm leading-snug">
              Diagnóstico Automatizado
            </h3>
            <p className="text-xs text-white/70 mt-2 leading-relaxed">
              O app analisa seus erros e acertos em tempo real e aponta
              exatamente qual das 6 matérias do edital você precisa reforçar.
            </p>
          </article>

          {/* Card 2 */}
          <article className="relative bg-card/60 backdrop-blur border border-border/40 rounded-2xl p-5 text-left">
            <div className="w-10 h-10 rounded-xl bg-gradient-flame flex items-center justify-center shadow-flame mb-3">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-display font-bold text-sm leading-snug">
              Foco no Edital de Minas
            </h3>
            <p className="text-xs text-white/70 mt-2 leading-relaxed">
              Nada de perder tempo com conteúdo de outros estados. Questões
              organizadas estritamente de acordo com o concurso do CBMMG
              (incluindo Proteção e Defesa Civil).
            </p>
          </article>

          {/* Card 3 */}
          <article className="relative bg-card/60 backdrop-blur border border-border/40 rounded-2xl p-5 text-left">
            <div className="w-10 h-10 rounded-xl bg-gradient-flame flex items-center justify-center shadow-flame mb-3">
              <Timer className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-display font-bold text-sm leading-snug">
              Simulados de Reta Final
            </h3>
            <p className="text-xs text-white/70 mt-2 leading-relaxed">
              Treine com cronômetro e questões selecionadas no padrão da banca
              para se adaptar ao ritmo do dia oficial.
            </p>
          </article>
        </div>
      </section>

      {/* ========== FORMULÁRIO / OFERTA ========== */}
      <section className="px-5 pb-12">
        <div className="max-w-xl mx-auto">
          {!submitted ? (
            <div className="relative bg-gradient-to-b from-card/80 to-card/40 border-2 border-primary/30 rounded-2xl p-6 sm:p-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-warning text-warning-foreground px-4 py-1 rounded-full text-[10px] stencil font-bold flex items-center gap-1.5 shadow-card whitespace-nowrap">
                <AlertTriangle className="w-3 h-3" /> INSCRITOS NA RETA FINAL
              </div>

              <h2 className="text-lg font-display font-bold text-center mt-2">
                Preencha os campos abaixo para liberar seu Super Bônus e ativar
                as ferramentas de diagnóstico.
              </h2>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <Label
                    htmlFor="lp-name"
                    className="stencil text-[10px] text-white/60"
                  >
                    Nome completo
                  </Label>
                  <Input
                    id="lp-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: João Silva"
                    maxLength={100}
                    className="mt-1 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-primary"
                  />
                  {errors.name && (
                    <p className="text-[11px] text-destructive mt-1">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="lp-email"
                    className="stencil text-[10px] text-white/60"
                  >
                    E-mail
                  </Label>
                  <Input
                    id="lp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    maxLength={255}
                    className="mt-1 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-primary"
                  />
                  {errors.email && (
                    <p className="text-[11px] text-destructive mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="lp-phone"
                    className="stencil text-[10px] text-white/60"
                  >
                    Telefone (WhatsApp)
                  </Label>
                  <Input
                    id="lp-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(31) 99999-9999"
                    maxLength={30}
                    className="mt-1 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-primary"
                  />
                  {errors.phone && (
                    <p className="text-[11px] text-destructive mt-1">
                      {errors.phone}
                    </p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="lp-insta"
                    className="stencil text-[10px] text-white/60"
                  >
                    @ do Instagram
                  </Label>
                  <div className="mt-1 flex items-center h-12 rounded-md bg-white/10 border border-white/20 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                    <span className="pl-4 text-white/50">@</span>
                    <input
                      id="lp-insta"
                      type="text"
                      value={instagram}
                      onChange={(e) =>
                        setInstagram(e.target.value.replace(/^@/, ""))
                      }
                      placeholder="seu.perfil"
                      maxLength={40}
                      className="flex-1 h-full px-2 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                    />
                  </div>
                  {errors.instagram && (
                    <p className="text-[11px] text-destructive mt-1">
                      {errors.instagram}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-13 mt-2 py-3.5 bg-gradient-flame text-white font-display text-base stencil shadow-flame"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Liberar meu Super Bônus{" "}
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-white/50 text-center mt-3 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> Seus dados estão protegidos.
                  Nunca enviamos spam.
                </p>
              </form>
            </div>
          ) : (
            <div className="relative bg-gradient-to-b from-card/80 to-card/40 border-2 border-primary/30 rounded-2xl p-6 sm:p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-flame shadow-flame mb-4">
                <ShieldCheck className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-display font-bold">
                Bônus Liberado!
              </h2>
              <p className="text-sm text-white/75 mt-2">
                Seu acesso está quase garantido. Aproveite a oferta exclusiva da
                Reta Final.
              </p>

              <Button
                asChild
                className="w-full h-13 mt-6 py-3.5 bg-gradient-flame text-white font-display text-base stencil shadow-flame animate-pulse-flame"
              >
                <a
                  href={KIWI_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GARANTA SUA APROVAÇÃO POR APENAS R$ 49,90{" "}
                  <ChevronRight className="w-5 h-5 ml-1" />
                </a>
              </Button>

              <div className="mt-4 inline-flex items-center gap-2 bg-warning/20 text-warning rounded-lg px-3 py-2">
                <Lock className="w-3.5 h-3.5" />
                <p className="text-[11px] font-medium">
                  Acesso Premium liberado imediatamente. Valor único com
                  validade garantida até o dia da prova do CBMMG.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========== RODAPÉ ========== */}
      <footer className="px-5 pb-8 text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-[10px] text-white/40">
            Questão Certa CBMMG — Método focado no edital de Minas Gerais.
          </p>
          <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-white/50">
            <Link
              to="/auth"
              className="hover:text-primary transition-colors underline underline-offset-4"
            >
              Já tem conta? Entrar
            </Link>
            <span className="text-white/20">|</span>
            <Link
              to="/diagnostico"
              className="hover:text-primary transition-colors underline underline-offset-4"
            >
              Fazer diagnóstico grátis
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
