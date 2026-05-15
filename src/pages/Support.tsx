import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MessageSquare, Send, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const TYPES = [
  { value: "duvida_tecnica", label: "Dúvida Técnica" },
  { value: "erro_questao", label: "Erro em Questão" },
  { value: "sugestao_melhoria", label: "Sugestão de Melhoria" },
  { value: "outros", label: "Outros" },
];

const schema = z.object({
  type: z.string().min(1, "Selecione o tipo de mensagem"),
  message: z.string().trim().min(10, "Escreva ao menos 10 caracteres").max(2000, "Máximo de 2000 caracteres"),
});

const Support = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const parsed = schema.safeParse({ type, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!user) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from("support_messages").insert({
      user_id: user.id,
      user_email: user.email,
      type: parsed.data.type,
      message: parsed.data.message,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar. Tente novamente.");
      return;
    }
    toast.success("Mensagem enviada com sucesso! Nossa equipe analisará seu contato.");
    setType("");
    setMessage("");
  };

  return (
    <AppShell>
      <header className="bg-gradient-night text-white px-5 pt-12 pb-10 rounded-b-[2rem]">
        <button onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="mt-2 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-flame shadow-flame flex items-center justify-center">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="stencil text-[10px] text-primary">Canal Direto</p>
            <h1 className="font-display text-xl font-bold">Sala de Comando</h1>
          </div>
        </div>
        <p className="text-xs text-white/80 mt-3 leading-relaxed">
          Envie dúvidas, reporte erros em questões ou sugira melhorias. Nossa equipe responde no menor tempo possível.
        </p>
      </header>

      <main className="px-5 -mt-6 pb-8 space-y-4 relative">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
          <div className="space-y-2">
            <label className="stencil text-[11px] text-muted-foreground">Tipo de mensagem</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="stencil text-[11px] text-muted-foreground">Mensagem</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva sua dúvida, erro encontrado ou sugestão..."
              rows={6}
              maxLength={2000}
            />
            <p className="text-[10px] text-muted-foreground text-right">{message.length}/2000</p>
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full bg-gradient-flame text-white font-display stencil">
            <Send className="w-4 h-4 mr-2" /> {submitting ? "Enviando..." : "Enviar mensagem"}
          </Button>
        </div>

        <div className="bg-muted/40 border border-border rounded-2xl p-4 text-xs text-muted-foreground flex gap-3">
          <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>Toda mensagem é registrada e acompanhada pela equipe. Você receberá retorno pelo seu e-mail cadastrado.</p>
        </div>
      </main>
    </AppShell>
  );
};

export default Support;
