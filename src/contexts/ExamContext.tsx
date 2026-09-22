import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ContentNode,
  Enrollment,
  ExamRef,
  fetchContentNodes,
  fetchMyEnrollments,
} from "@/lib/exams";

// O edital ativo. Todo conteúdo e toda estatística do app vivem dentro dele.
// Quem tem uma matrícula só nunca vê o seletor; quem tem duas escolhe, e a
// escolha fica guardada no navegador.

const STORAGE_KEY = "mqc_edital_ativo";

type ExamCtx = {
  enrollments: Enrollment[];
  exam: ExamRef | null;
  nodes: ContentNode[];
  loading: boolean;
  /** Tem matrícula ativa em algum edital. */
  hasEnrollment: boolean;
  setExam: (examId: string) => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<ExamCtx>({
  enrollments: [],
  exam: null,
  nodes: [],
  loading: true,
  hasEnrollment: false,
  setExam: () => {},
  refresh: async () => {},
});

export const ExamProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [examId, setExamId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  // Usuário cujas matrículas estão no estado (mesmo cuidado do useProfile:
  // efeitos rodam depois do render, e quem decide acesso não pode ver estado velho).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [nodesFor, setNodesFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setEnrollments([]);
      setExamId(null);
      setNodes([]);
      setLoadedFor(null);
      return;
    }
    const list = await fetchMyEnrollments(user.id);
    setEnrollments(list);
    const saved = localStorage.getItem(STORAGE_KEY);
    const chosen = list.find((e) => e.exam.id === saved) ?? list[0] ?? null;
    setExamId(chosen?.exam.id ?? null);
    setLoadedFor(user.id);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const exam = useMemo(
    () => enrollments.find((e) => e.exam.id === examId)?.exam ?? null,
    [enrollments, examId],
  );

  useEffect(() => {
    if (!exam) {
      setNodes([]);
      setNodesFor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const list = await fetchContentNodes(exam.id);
      if (cancelled) return;
      setNodes(list);
      setNodesFor(exam.id);
    })();
    return () => { cancelled = true; };
  }, [exam]);

  // O app veste as cores da instituição do edital ativo (ver src/index.css).
  // Sem edital, volta ao tema padrão — é o caso da tela de login.
  useEffect(() => {
    const sigla = exam?.institution_sigla?.toLowerCase();
    if (sigla) document.documentElement.dataset.instituicao = sigla;
    else delete document.documentElement.dataset.instituicao;
  }, [exam?.institution_sigla]);

  const setExam = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setExamId(id);
  }, []);

  const loading = (user?.id ?? null) !== loadedFor || (!!exam && nodesFor !== exam.id);

  return (
    <Ctx.Provider
      value={{ enrollments, exam, nodes, loading, hasEnrollment: enrollments.length > 0, setExam, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useExam = () => useContext(Ctx);
