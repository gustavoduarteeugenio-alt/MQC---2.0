import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useExam } from "@/contexts/ExamContext";
import { ContentNode, childrenOf, disciplinesOf, examLabel, fetchQuestionCounts, countWithSubtree } from "@/lib/exams";

/**
 * Navegação pela árvore de conteúdo do edital ativo: disciplina → tópico →
 * subtópico. Em qualquer nível dá para treinar o nó, e o treino inclui os
 * filhos dele.
 *
 * Regra de produto preservada: o app não informa quantas questões existem.
 * A contagem é usada apenas para desabilitar o que está vazio.
 */
const Subjects = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { exam, nodes, loading } = useExam();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const parentSlug = params.get("em");
  const parent = parentSlug ? nodes.find((n) => n.slug === parentSlug) ?? null : null;
  const list: ContentNode[] = parent ? childrenOf(nodes, parent.id) : disciplinesOf(nodes);

  useEffect(() => {
    if (!exam) return;
    let cancelled = false;
    fetchQuestionCounts(exam.id).then((c) => { if (!cancelled) setCounts(c); });
    return () => { cancelled = true; };
  }, [exam]);

  const open = (node: ContentNode) => {
    if (childrenOf(nodes, node.id).length > 0) {
      setParams({ em: node.slug });
      return;
    }
    navigate(`/questao/${node.slug}`);
  };

  return (
    <AppShell>
      <header className="px-5 pt-12 pb-5 bg-gradient-dark text-white">
        <p className="stencil text-xs text-primary">{exam ? examLabel(exam) : "Conteúdo"}</p>
        {parent ? (
          <>
            <button
              onClick={() => setParams({})}
              className="mt-1 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Todas as matérias
            </button>
            <h1 className="text-2xl font-display font-bold mt-1">{parent.name}</h1>
            <p className="text-sm text-white/70 mt-1">Escolha um assunto ou treine a matéria inteira.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-display font-bold">Matérias</h1>
            <p className="text-sm text-white/70 mt-1">Selecione uma frente de batalha.</p>
          </>
        )}
      </header>

      <main className="px-5 py-5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">
            Este edital ainda não tem conteúdo cadastrado.
          </p>
        ) : (
          <>
            {parent && (
              <button
                onClick={() => navigate(`/questao/${parent.slug}`)}
                disabled={countWithSubtree(nodes, counts, parent.id) === 0}
                className="w-full flex items-center gap-3 bg-gradient-brand text-white rounded-2xl p-4 shadow-brand disabled:opacity-50"
              >
                <div className="flex-1 text-left">
                  <p className="stencil text-[10px] opacity-90">Treinar</p>
                  <p className="font-display font-semibold">{parent.name} inteira</p>
                </div>
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {list.map((node) => {
              const filhos = childrenOf(nodes, node.id).length;
              const vazio = countWithSubtree(nodes, counts, node.id) === 0;
              return (
                <button
                  key={node.id}
                  onClick={() => open(node)}
                  disabled={vazio && filhos === 0}
                  className={`w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 shadow-card text-left transition-all ${
                    vazio && filhos === 0 ? "opacity-50" : "active:scale-[0.98] hover:border-primary/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold leading-tight">{node.name}</p>
                    {node.level === 1 && node.weight != null && (
                      <p className="stencil text-[10px] text-muted-foreground mt-0.5">
                        {node.weight} questões na prova oficial
                      </p>
                    )}
                    {filhos > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {filhos} {filhos === 1 ? "assunto" : "assuntos"}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </>
        )}
      </main>
    </AppShell>
  );
};

export default Subjects;
