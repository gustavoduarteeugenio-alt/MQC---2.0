import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useExam } from "@/contexts/ExamContext";
import { Button } from "@/components/ui/button";
import { Target, Loader2, ChevronRight, LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Opcao = {
  exam_id: string;
  nome: string;
  instituicao: string;
  sigla: string;
  duracao_minutos: number;
};

/**
 * Quem comprou o produto individual escolhe aqui o concurso que vai estudar.
 * No momento da compra o aluno não sabe que está escolhendo um edital — o
 * primeiro comprador pegou o produto pensando no bombeiro — então a escolha
 * acontece dentro do app, onde dá para explicar o que ela significa.
 */
const EscolherConcurso = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { refresh } = useExam();
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("editais_para_escolher");
    if (error) toast.error("Não conseguimos carregar os concursos. Tente recarregar a página.");
    setOpcoes((data ?? []) as Opcao[]);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Sem nada a escolher, esta tela não tem função. Vai para /sem-acesso, e não
  // para a raiz: a raiz devolveria para cá e ficaríamos em laço.
  useEffect(() => {
    if (!carregando && opcoes.length === 0) navigate("/sem-acesso", { replace: true });
  }, [carregando, opcoes.length, navigate]);

  const escolher = async (o: Opcao) => {
    setSalvando(o.exam_id);
    const { error } = await (supabase as any).rpc("escolher_edital", { _exam_id: o.exam_id });
    if (error) {
      setSalvando(null);
      toast.error(error.message ?? "Não conseguimos registrar sua escolha.");
      return;
    }
    await refresh();
    // Recarrega para as rotas protegidas lerem a matrícula nova
    window.location.assign("/");
  };

  if (carregando) {
    return (
      <div className="app-shell flex items-center justify-center bg-gradient-dark">
        <Target className="w-10 h-10 text-primary animate-pulse-brand" />
      </div>
    );
  }

  return (
    <div className="app-shell bg-gradient-dark text-white flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        <header className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-brand shadow-brand mb-5">
            <Target className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <p className="stencil text-xs text-primary">Seu acesso está liberado</p>
          <h1 className="text-2xl font-display font-bold mt-1">Qual concurso você vai prestar?</h1>
          <p className="text-sm text-white/70 mt-3 max-w-sm mx-auto leading-relaxed">
            O app monta seu treino, seus simulados e seu ranking em cima do edital que você
            escolher. Dá para mudar depois — é só falar com o suporte.
          </p>
        </header>

        <div className="mt-8 space-y-3">
          {opcoes.map((o) => (
            <button
              key={o.exam_id}
              onClick={() => escolher(o)}
              disabled={salvando !== null}
              className={cn(
                "w-full flex items-center gap-4 rounded-2xl border-2 border-white/15 bg-white/5 p-4 text-left transition-all",
                "hover:border-primary/60 hover:bg-white/10 disabled:opacity-50",
                salvando === o.exam_id && "border-primary",
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="stencil text-[10px] text-primary">{o.sigla}</p>
                <p className="font-display text-lg font-bold leading-tight">{o.nome}</p>
                <p className="text-xs text-white/60 mt-0.5 truncate">{o.instituicao}</p>
              </div>
              {salvando === o.exam_id
                ? <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                : <ChevronRight className="w-5 h-5 text-white/50 shrink-0" />}
            </button>
          ))}
        </div>

        <button
          onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}
          className="mt-10 mx-auto flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 stencil"
        >
          <LogOut className="w-3.5 h-3.5" /> Sair da conta
        </button>
      </div>
    </div>
  );
};

export default EscolherConcurso;
