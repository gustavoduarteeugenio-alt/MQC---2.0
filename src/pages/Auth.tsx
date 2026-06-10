import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Flame, Shield, Loader2, Eye, EyeOff, AlertTriangle, Send, CheckCircle2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe seu nome").max(100),
    email: z.string().trim().email("E-mail inválido").max(255),
    password: z.string().min(6, "Mínimo 6 caracteres").max(72),
    confirmPassword: z.string().min(1, "Confirme sua senha").max(72),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem",
  });

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(1, "Informe sua senha").max(72),
});

type PwdFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string | null;
  placeholder?: string;
};

const PasswordField = ({ id, label, value, onChange, hint, placeholder = "••••••" }: PwdFieldProps) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-white/80 stencil text-xs">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 pr-12"
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-md text-slate-300 hover:text-white hover:bg-white/10 active:bg-white/15 transition"
        >
          {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-amber-300/90 mt-1 pl-0.5">{hint}</p>}
    </div>
  );
};

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(searchParams.get("signup") === "1" ? "signup" : "signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [origem, setOrigem] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(() => localStorage.getItem("pending_approval_email"));
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportSent, setSupportSent] = useState(false);
  const [accessReleased, setAccessReleased] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  // Poll approval status while waiting for admin
  useEffect(() => {
    if (!pendingEmail || accessReleased) return;
    let cancelled = false;
    const check = async () => {
      const { data, error } = await (supabase as any).rpc("check_account_approved", { email_input: pendingEmail });
      if (!cancelled && !error && data === true) setAccessReleased(true);
    };
    check();
    const id = setInterval(check, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pendingEmail, accessReleased]);

  const passwordHint =
    mode === "signup" && password.length > 0 && password.length < 6
      ? "A senha deve ter no mínimo 6 caracteres."
      : null;

  const confirmHint =
    mode === "signup" && confirmPassword.length > 0 && confirmPassword !== password
      ? "As senhas não coincidem."
      : null;

  const linkPendingDiagnostic = async (userId: string) => {
    const token = localStorage.getItem("diag_pending_token");
    if (!token) return;
    const { data, error } = await (supabase as any).rpc("claim_diagnostic_session", {
      _client_token: token,
    });
    if (error || !data?.ok) { localStorage.removeItem("diag_pending_token"); return; }
    if (data.results) {
      await supabase
        .from("profiles")
        .update({
          diagnostic_results: data.results as any,
          diagnostic_completed_at: data.completed_at ?? new Date().toISOString(),
        } as any)
        .eq("user_id", userId);
    }
    localStorage.removeItem("diag_pending_token");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ fullName, email, password, confirmPassword });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: parsed.data.fullName, origem: origem || null },
          },
        });
        if (error) {
          if (error.message.includes("registered")) toast.error("Este e-mail já está cadastrado.");
          else toast.error(error.message);
          return;
        }
        if (signUpData.user) await linkPendingDiagnostic(signUpData.user.id);
        // Conta criada mas precisa de aprovação do admin
        await supabase.auth.signOut();
        toast.success("Conta criada! Aguarde a liberação do administrador para acessar.");
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          toast.error("Credenciais inválidas.");
          return;
        }
        // Checar se a conta foi aprovada pelo admin
        if (signInData.user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("approved" as any)
            .eq("user_id", signInData.user.id)
            .maybeSingle();
          if (!prof || (prof as any).approved !== true) {
            await supabase.auth.signOut();
            localStorage.setItem("pending_approval_email", parsed.data.email);
            setPendingEmail(parsed.data.email);
            setSupportSent(false);
            setSupportMessage("");
            return;
          }
          localStorage.removeItem("pending_approval_email");
          await linkPendingDiagnostic(signInData.user.id);
        }
        navigate("/", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const sendSupport = async () => {
    if (!pendingEmail) return;
    const msg = supportMessage.trim();
    if (msg.length < 3) {
      toast.error("Escreva uma mensagem antes de enviar.");
      return;
    }
    setSupportSending(true);
    const { error } = await (supabase as any).from("tickets_suporte").insert({
      user_id: null,
      email_usuario: pendingEmail,
      mensagem: msg,
    });
    setSupportSending(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
      return;
    }
    setSupportSent(true);
    setSupportMessage("");
    toast.success("Mensagem enviada! Analisaremos seu acesso prioritariamente.");
  };

  const backToLogin = () => {
    if (pendingEmail) setEmail(pendingEmail);
    localStorage.removeItem("pending_approval_email");
    setPendingEmail(null);
    setAccessReleased(false);
    setSupportSent(false);
    setSupportMessage("");
    setMode("signin");
  };

  return (
    <div className="app-shell bg-gradient-night text-white flex flex-col">
      <div className="flex-1 flex flex-col justify-between px-6 pt-12 pb-6">
        <header className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-flame shadow-flame mb-5">
            <Flame className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-wide">Método Questão Certa</h1>
          <p className="stencil text-xs text-primary mt-1">CFSd CBMMG 2027 · Banca IDECAN</p>
          <p className="text-sm text-white/70 mt-3 max-w-xs mx-auto">
            O caminho até a farda começa aqui. Treine com questões inéditas no estilo da banca.
          </p>
        </header>

        {pendingEmail && accessReleased ? (
          <div className="animate-fade-in">
            <div className="bg-success/10 border-2 border-success/60 rounded-2xl p-6 shadow-flame backdrop-blur space-y-4">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-success/20 border border-success/60 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-success" />
                </div>
                <h2 className="font-display text-xl font-bold text-success">
                  ✅ Acesso liberado!
                </h2>
                <p className="text-sm text-white/85 leading-relaxed">
                  Seu acesso foi aprovado pelo administrador. Faça login para iniciar sua preparação.
                </p>
                <p className="text-[11px] text-white/60 stencil mt-1">E-mail: {pendingEmail}</p>
              </div>

              <Button
                type="button"
                onClick={backToLogin}
                className="w-full h-12 bg-gradient-flame hover:opacity-95 text-white font-display tracking-wider shadow-flame stencil"
              >
                Ir para o login
              </Button>
            </div>
          </div>
        ) : pendingEmail ? (
          <div className="animate-fade-in">
            <div className="bg-amber-500/10 border-2 border-amber-400/70 rounded-2xl p-5 shadow-flame backdrop-blur space-y-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-400/60 flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-7 h-7 text-amber-300" />
                </div>
                <h2 className="font-display text-lg font-bold text-amber-100">
                  ⚠️ Aguardando liberação do administrador
                </h2>
                <p className="text-sm text-white/80 leading-relaxed">
                  Seu cadastro foi realizado com sucesso! Nossa equipe está validando seu acesso junto à plataforma de pagamento.
                  Em breve suas frentes de combate estarão liberadas. Se preferir, envie uma mensagem direto para o nosso suporte abaixo.
                </p>
                <p className="text-[11px] text-amber-200/80 stencil mt-1">E-mail: {pendingEmail}</p>
              </div>

              {supportSent ? (
                <div className="flex flex-col items-center gap-2 py-3 text-success">
                  <CheckCircle2 className="w-8 h-8" />
                  <p className="text-sm font-semibold text-success-foreground">Mensagem enviada com sucesso!</p>
                  <p className="text-xs text-white/70 text-center">Analisaremos seu acesso prioritariamente.</p>
                </div>
              ) : (
                <>
                  <Textarea
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Digite sua mensagem ou informe o e-mail cadastrado na Kiwifi..."
                    rows={4}
                    maxLength={2000}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                  <Button
                    type="button"
                    onClick={sendSupport}
                    disabled={supportSending || supportMessage.trim().length < 3}
                    className="w-full h-12 bg-gradient-flame hover:opacity-95 text-white font-display tracking-wider shadow-flame stencil"
                  >
                    {supportSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar para o Suporte
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>

            <p className="text-center text-[11px] text-white/50 stencil pt-1">
              Esta mensagem permanecerá visível até a liberação do seu acesso.
            </p>

            <Button
              type="button"
              variant="outline"
              onClick={backToLogin}
              className="w-full h-11 mt-2 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white stencil"
            >
              Voltar para o login
            </Button>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-3 animate-fade-in">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-white/80 stencil text-xs">Nome completo</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="João da Silva"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/80 stencil text-xs">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12"
              />
            </div>

            <PasswordField
              id="pwd"
              label="Senha"
              value={password}
              onChange={setPassword}
              hint={passwordHint}
            />

            {mode === "signup" && (
              <PasswordField
                id="pwd-confirm"
                label="Confirmar senha"
                value={confirmPassword}
                onChange={setConfirmPassword}
                hint={confirmHint}
              />
            )}

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="origem" className="text-white/80 stencil text-xs">
                  Como você nos conheceu? <span className="text-white/40 normal-case">(opcional)</span>
                </Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger id="origem" className="bg-white/10 border-white/20 text-white h-12 data-[placeholder]:text-white/40">
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Indicação de Amigo">Indicação de Amigo</SelectItem>
                    <SelectItem value="Grupos de Estudo">Grupos de Estudo</SelectItem>
                    <SelectItem value="Google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === "signin" && (
              <div className="flex justify-end pt-0.5">
                <Link
                  to="/recuperar-senha"
                  className="text-xs text-slate-300 hover:text-primary underline-offset-4 hover:underline transition"
                >
                  Esqueceu sua senha?
                </Link>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full h-13 py-3.5 bg-gradient-flame hover:opacity-95 text-white font-display text-base tracking-wider shadow-flame stencil",
            )}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === "signup" ? "Alistar-se" : "Entrar no quartel"}
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-sm text-white/70 hover:text-white py-2 transition"
          >
            {mode === "signin" ? "Ainda não tem conta? " : "Já é recruta? "}
            <span className="text-primary font-semibold underline-offset-4 hover:underline">
              {mode === "signin" ? "Cadastre-se" : "Entrar"}
            </span>
          </button>
        </form>
        )}

        <footer className="text-center text-[11px] text-white/40 stencil flex items-center justify-center gap-2">
          <Shield className="w-3 h-3" /> Honra · Disciplina · Coragem
        </footer>
      </div>
    </div>
  );
};

export default Auth;
