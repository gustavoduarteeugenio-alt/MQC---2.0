import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Target, ArrowLeft, Loader2, MailCheck } from "lucide-react";

const emailSchema = z.string().trim().email("E-mail inválido").max(255);

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSent(true);
      toast.success("Instruções enviadas para seu e-mail.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell bg-gradient-dark text-white flex flex-col">
      <div className="flex-1 flex flex-col justify-between px-6 pt-12 pb-6">
        <header className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-brand shadow-brand mb-5">
            <Target className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-wide">Recuperar Senha</h1>
          <p className="stencil text-xs text-primary mt-1">Quartel virtual · Resgate de acesso</p>
          <p className="text-sm text-white/70 mt-3 max-w-xs mx-auto">
            Informe o e-mail do seu cadastro para receber as instruções de redefinição.
          </p>
        </header>

        {sent ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-3 animate-fade-in">
            <MailCheck className="w-12 h-12 text-primary mx-auto" />
            <p className="text-sm text-white/80">
              Se houver uma conta para <span className="text-white font-semibold">{email}</span>, você receberá um link para redefinir sua senha.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 animate-fade-in">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur space-y-3">
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
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-13 py-3.5 bg-gradient-brand hover:opacity-95 text-white font-display text-base tracking-wider shadow-brand stencil"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar instruções"}
            </Button>
          </form>
        )}

        <Link
          to="/auth"
          className="text-sm text-white/70 hover:text-white py-2 transition flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o login
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
