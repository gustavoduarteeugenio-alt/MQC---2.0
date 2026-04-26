import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Flame, Shield, Loader2 } from "lucide-react";
import { useEffect } from "react";

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});
const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(1, "Informe sua senha").max(72),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ fullName, email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: parsed.data.fullName },
          },
        });
        if (error) {
          if (error.message.includes("registered")) toast.error("Este e-mail já está cadastrado.");
          else toast.error(error.message);
          return;
        }
        toast.success("Conta criada! Bem-vindo, recruta.");
        navigate("/", { replace: true });
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) {
          toast.error("Credenciais inválidas.");
          return;
        }
        navigate("/", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell bg-gradient-night text-white flex flex-col">
      <div className="flex-1 flex flex-col justify-between px-6 pt-12 pb-6">
        <header className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-flame shadow-flame mb-5">
            <Flame className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-wide">CFSd CBMMG 2027</h1>
          <p className="stencil text-xs text-primary mt-1">Banca IDECAN · Quartel virtual</p>
          <p className="text-sm text-white/70 mt-3 max-w-xs mx-auto">
            O caminho até a farda começa aqui. Treine com questões inéditas no estilo da banca.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-3 animate-fade-in">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-white/80 stencil text-xs">Nome completo</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="João da Silva"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/80 stencil text-xs">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd" className="text-white/80 stencil text-xs">Senha</Label>
              <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12" />
            </div>
          </div>

          <Button type="submit" disabled={loading}
            className="w-full h-13 py-3.5 bg-gradient-flame hover:opacity-95 text-white font-display text-base tracking-wider shadow-flame stencil">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === "signup" ? "Alistar-se" : "Entrar no quartel"}
          </Button>

          <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-sm text-white/70 hover:text-white py-2 transition">
            {mode === "signin" ? "Ainda não tem conta? " : "Já é recruta? "}
            <span className="text-primary font-semibold underline-offset-4 hover:underline">
              {mode === "signin" ? "Cadastre-se" : "Entrar"}
            </span>
          </button>
        </form>

        <footer className="text-center text-[11px] text-white/40 stencil flex items-center justify-center gap-2">
          <Shield className="w-3 h-3" /> Honra · Disciplina · Coragem
        </footer>
      </div>
    </div>
  );
};

export default Auth;
