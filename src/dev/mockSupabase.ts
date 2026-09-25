// Cliente Supabase falso, para trabalhar na interface sem banco e sem login.
//
// Entra em cena APENAS com `npm run dev:ui`, que roda o Vite no modo ui-mock e
// troca "@/integrations/supabase/client" por este arquivo (ver vite.config.ts).
// O build de produção não conhece este módulo.

type Row = Record<string, any>;

const uid = "00000000-0000-4000-8000-000000000001";
const email = "aluno.teste@exemplo.com";

const SUBJECTS: Row[] = [
  { id: "s1", name: "Língua Portuguesa", slug: "lingua-portuguesa", icon: "BookOpen", display_order: 1 },
  { id: "s2", name: "Raciocínio Lógico e Matemático", slug: "rlm", icon: "Brain", display_order: 2 },
  { id: "s3", name: "Noções de Direitos Humanos e Legislação", slug: "direitos-humanos-legislacao", icon: "Scale", display_order: 3 },
  { id: "s4", name: "Ciências Naturais", slug: "ciencias-naturais", icon: "FlaskConical", display_order: 4 },
  { id: "s5", name: "Ciências Humanas", slug: "ciencias-humanas", icon: "Landmark", display_order: 5 },
  { id: "s6", name: "Proteção e Defesa Civil", slug: "protecao-defesa-civil", icon: "ShieldCheck", display_order: 6 },
];

const QUESTIONS: Row[] = SUBJECTS.flatMap((s, si) =>
  Array.from({ length: 14 }, (_, i) => ({
    id: `q${si + 1}-${i + 1}`,
    subject_id: s.id,
    statement:
      `(${s.name} · questão ${i + 1}) Durante uma ocorrência de incêndio em edificação residencial, ` +
      `o militar deve priorizar a ação que melhor atenda ao princípio da preservação da vida. Assinale a alternativa correta.`,
    option_a: "Iniciar o combate ao fogo antes de qualquer avaliação do cenário.",
    option_b: "Realizar o reconhecimento da cena e o resgate das vítimas em risco iminente.",
    option_c: "Aguardar a chegada de viatura de apoio sem intervir.",
    option_d: "Interditar a via pública e encerrar o atendimento.",
    option_e: "Acionar a defesa civil e retornar à unidade.",
    image_url: null,
  })),
);

// Histórico com desempenho desigual, para as telas de estatística terem o que mostrar
const ATTEMPTS: Row[] = SUBJECTS.flatMap((s, si) => {
  const acertos = [9, 7, 5, 8, 4, 6][si];
  const total = 12;
  return Array.from({ length: total }, (_, i) => ({
    id: `a${si}-${i}`,
    user_id: uid,
    question_id: `q${si + 1}-${i + 1}`,
    selected_answer: "B",
    is_correct: i < acertos,
    time_seconds: 40 + i,
    created_at: new Date(Date.now() - (si * 12 + i) * 36e5).toISOString(),
    questions: { subject_id: s.id, subjects: { name: s.name, slug: s.slug } },
  }));
});

const PROFILE: Row = {
  id: "p1",
  user_id: uid,
  full_name: "Aluno de Teste",
  email,
  approved: true,
  access_until: new Date(Date.now() + 300 * 864e5).toISOString(),
  onboarding_completed_at: new Date().toISOString(),
  ranking_name: "Recruta Teste",
  show_in_ranking: true,
};

// ---- Estrutura multi-edital ----
const INSTITUTIONS: Row[] = [
  { id: "i1", name: "Corpo de Bombeiros Militar de Minas Gerais", sigla: "CBMMG", slug: "cbmmg" },
  { id: "i2", name: "Polícia Militar de Minas Gerais", sigla: "PMMG", slug: "pmmg" },
];
const CONTESTS: Row[] = [
  { id: "ct1", institution_id: "i1", name: "Curso de Formação de Soldados", slug: "cfsd" },
  { id: "ct2", institution_id: "i2", name: "Curso de Formação de Soldados", slug: "cfsd" },
];
const EXAMS: Row[] = [
  { id: "e1", contest_id: "ct1", name: "CFSd BM 2027", slug: "cbmmg-cfsd-bm-2027", year: 2027, duration_minutes: 240, is_published: true,
    contests: { name: "Curso de Formação de Soldados", institutions: { name: INSTITUTIONS[0].name, sigla: "CBMMG" } } },
  { id: "e2", contest_id: "ct2", name: "CFSd 2025", slug: "pmmg-cfsd-2025", year: 2025, duration_minutes: 180, is_published: true,
    contests: { name: "Curso de Formação de Soldados", institutions: { name: INSTITUTIONS[1].name, sigla: "PMMG" } } },
];

// Árvore do CBMMG: as 6 disciplinas, com subtópicos em Ciências Naturais para
// exercitar os três níveis; e uma árvore menor para o PMMG.
const NODES: Row[] = [];
const addNode = (exam_id: string, parent_id: string | null, name: string, slug: string, level: number, order: number, weight: number | null = null) => {
  const id = `n${NODES.length + 1}`;
  NODES.push({ id, exam_id, parent_id, name, slug, level, display_order: order, weight });
  return id;
};
const CB = [
  { name: "Língua Portuguesa", slug: "lingua-portuguesa", w: 10, t: ["Compreensão e interpretação de textos", "Ortografia e acentuação", "Concordância verbal e nominal"] },
  { name: "Raciocínio Lógico e Matemático", slug: "rlm", w: 5, t: ["Estruturas lógicas", "Operações com conjuntos"] },
  { name: "Noções de Direitos Humanos e Legislação", slug: "direitos-humanos-legislacao", w: 10, t: ["Declaração Universal", "Constituição Federal"] },
  { name: "Ciências Naturais", slug: "ciencias-naturais", w: 10, t: ["Química", "Física", "Biologia e fisiologia humana"] },
  { name: "Ciências Humanas", slug: "ciencias-humanas", w: 10, t: ["História de Minas Gerais", "Mineração"] },
  { name: "Proteção e Defesa Civil", slug: "protecao-defesa-civil", w: 5, t: ["Gestão de riscos e desastres"] },
];
CB.forEach((d, di) => {
  const pid = addNode("e1", null, d.name, d.slug, 1, di + 1, d.w);
  d.t.forEach((t, ti) => {
    const tid = addNode("e1", pid, t, t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-"), 2, ti + 1);
    if (d.slug === "ciencias-naturais") {
      ["Reações químicas", "Cinemática", "Genética"].slice(ti, ti + 1).forEach((s, si) =>
        addNode("e1", tid, s, s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-"), 3, si + 1));
    }
  });
});
[
  { name: "Língua Portuguesa e Interpretação de Textos", slug: "lp-pmmg", w: 20, t: ["Estudo de texto", "Crase"] },
  { name: "Literatura", slug: "literatura", w: 5, t: ["Campo Geral", "Vidas Secas"] },
  { name: "Noções de Língua Inglesa", slug: "ingles", w: 5, t: ["Interpretação de texto"] },
  { name: "Noções de Direito", slug: "direito", w: 10, t: ["Constituição Federal"] },
  { name: "Raciocínio Lógico-Matemático", slug: "rlm-pmmg", w: 10, t: ["Conjuntos", "Regra de três"] },
].forEach((d, di) => {
  const pid = addNode("e2", null, d.name, d.slug, 1, di + 1, d.w);
  d.t.forEach((t, ti) => addNode("e2", pid, t, `${d.slug}-${ti + 1}`, 2, ti + 1));
});

// Questões vinculadas ao CBMMG, distribuídas entre os nós folha
const FOLHAS = NODES.filter((n) => n.exam_id === "e1" && !NODES.some((c) => c.parent_id === n.id));
const EXAM_QUESTIONS: Row[] = QUESTIONS.map((q, i) => ({
  id: `eq${i + 1}`,
  exam_id: "e1",
  question_id: q.id,
  // A última fica sem classificação, como acontece quando alguém remove um
  // item da árvore: dá para exercitar o filtro "Sem classificação".
  content_node_id: i === QUESTIONS.length - 1 ? null : FOLHAS[i % FOLHAS.length].id,
  status: "published",
}));

// Duas matrículas, para o seletor de concurso aparecer
const ENROLLMENTS: Row[] = EXAMS.map((e, i) => ({
  id: `en${i + 1}`,
  user_id: uid,
  exam_id: e.id,
  access_until: new Date(Date.now() + 300 * 864e5).toISOString(),
  source: "manual",
  exams: e,
}));

// Tentativas passam a apontar para nó de conteúdo e edital
ATTEMPTS.forEach((a, i) => {
  a.exam_id = "e1";
  a.content_node_id = FOLHAS[i % FOLHAS.length].id;
});

const TABLES: Record<string, Row[]> = {
  institutions: INSTITUTIONS,
  contests: CONTESTS,
  exams: EXAMS,
  content_nodes: NODES,
  exam_questions: EXAM_QUESTIONS,
  enrollments: ENROLLMENTS,
  hotmart_products: [],
  question_imports: [],
  subjects: SUBJECTS,
  questions: QUESTIONS,
  attempts: ATTEMPTS,
  profiles: [PROFILE],
  daily_usage: [{ id: "d1", user_id: uid, usage_date: new Date().toISOString().slice(0, 10), questions_count: 12 }],
  user_roles: [{ user_id: uid, role: "user" }, { user_id: uid, role: "admin" }],
  simulados: [
    { id: "sim1", name: "Simulado Inédito 01", description: "Prova completa do CBMMG", exam_id: "e1", duration_minutes: 240, created_at: new Date().toISOString() },
    { id: "sim2", name: "Simulado PMMG 01", description: "Prova completa da PMMG", exam_id: "e2", duration_minutes: 180, created_at: new Date().toISOString() },
  ],
  simulado_questions: QUESTIONS.slice(0, 50).map((q, i) => ({ simulado_id: "sim1", question_id: q.id, position: i + 1 })),
  simulado_attempts: [],
  support_messages: [],
  support_replies: [],
  tickets_suporte: [],
  hotmart_purchases: [],
  // Um evento recebido, para dar para ver de onde sai o ID do produto
  hotmart_webhook_events: [{
    id: "ev1",
    hotmart_event_id: "hm-teste-1",
    event: "PURCHASE_APPROVED",
    action: "grant",
    transaction: "HP1234567890",
    email: "comprador.teste@exemplo.com",
    product_id: "9988776",
    applied: true,
    received_at: new Date().toISOString(),
  }],
};

// O ranking é por edital: no mock o PMMG tem menos gente, para dar para ver
// na tela que trocar de edital troca a disputa.
const rankingDoEdital = (examId: string) => {
  const tamanho = examId === "e2" ? 5 : 12;
  return Array.from({ length: tamanho }, (_, i) => ({
    rank_position: i + 1,
    user_id: i === 4 ? uid : `u${examId}${i}`,
    display_name: i === 4 ? "Recruta Teste" : `Recruta ${String.fromCharCode(65 + i)}`,
    is_anonymous: false,
    correct_count: 240 - i * 13,
    correct: 240 - i * 13,
    total: 300,
    duration_seconds: 7200 + i * 60,
    accuracy: 80 - i * 2,
  }));
};
const RANKING = rankingDoEdital("e1");

const RPCS: Record<string, (args: any) => any> = {
  reveal_question_answer: () => ({
    correct_answer: "B",
    explanation:
      "**Alternativa B.** O princípio da preservação da vida orienta que o reconhecimento da cena e o resgate " +
      "de vítimas em risco iminente antecedem o combate ao fogo.",
    comment_image_url: null,
  }),
  reveal_questions_answers: (args: any) =>
    (args?._ids ?? []).map((id: string) => ({ id, correct_answer: "B", explanation: "Comentário de teste.", comment_image_url: null })),
  check_account_approved: () => true,
  has_app_access: () => true,
  get_training_ranking: (args: any) => rankingDoEdital(args?._exam_id ?? "e1"),
  get_my_training_rank: (args: any) => {
    const lista = rankingDoEdital(args?._exam_id ?? "e1");
    return [{ rank_position: 5, correct_count: 188, total_users: lista.length }];
  },
  get_simulado_ranking: () => RANKING.slice(0, 8),
  get_my_simulado_rank: () => [{ rank_position: 3, total_users: 8, correct: 38, total: 50, duration_seconds: 7200 }],
  list_published_simulados: (args: any) =>
    (TABLES.simulados ?? [])
      .filter((s) => !args?._exam_id || s.exam_id === args._exam_id)
      .map((s) => ({
        id: s.id, name: s.name, description: s.description ?? null,
        created_at: s.created_at, duration_minutes: s.duration_minutes ?? 240,
        question_count: (TABLES.simulado_questions ?? []).filter((q) => q.simulado_id === s.id).length,
      }))
      .filter((s) => s.question_count > 0),
  list_hotmart_purchases: () => [],
  // Uma linha por produto, com os editais que ele libera
  admin_hotmart_products: () => {
    const porProduto: Record<string, { label: string | null; modo: string; ids: string[]; nomes: string[] }> = {};
    for (const p of TABLES.hotmart_products ?? []) {
      const g = (porProduto[p.product_id] ??= { label: p.label ?? null, modo: p.modo ?? "liberar", ids: [], nomes: [] });
      if (p.label) g.label = p.label;
      g.ids.push(p.exam_id);
      g.nomes.push((TABLES.exams ?? []).find((e) => e.id === p.exam_id)?.name ?? "?");
    }
    return Object.entries(porProduto).map(([product_id, g]) => ({
      product_id, label: g.label, modo: g.modo, exam_ids: g.ids, exam_names: g.nomes, compras_ativas: 0,
    }));
  },
  admin_set_hotmart_product: (args: any) => {
    const pid = String(args?._product_id ?? "").trim();
    const ids: string[] = args?._exam_ids ?? [];
    const tabela = (TABLES.hotmart_products ??= []);
    // Espelha a RPC: remove o que saiu da seleção e insere o que entrou
    for (let i = tabela.length - 1; i >= 0; i--) {
      if (tabela[i].product_id === pid && !ids.includes(tabela[i].exam_id)) tabela.splice(i, 1);
    }
    for (const exam_id of ids) {
      const atual = tabela.find((p) => p.product_id === pid && p.exam_id === exam_id);
      const modo = args?._modo ?? "liberar";
      if (atual) { atual.label = args?._label ?? null; atual.modo = modo; }
      else tabela.unshift({ product_id: pid, exam_id, label: args?._label ?? null, modo });
    }
    return ids.length;
  },
  // A tela de escolha só aparece com ?escolher=1 na URL: o aluno do mock já tem
  // as duas matrículas, então sem isso não haveria como exercitá-la.
  editais_para_escolher: () =>
    new URLSearchParams(location.search).has("escolher")
      ? (TABLES.exams ?? []).map((e) => ({
          exam_id: e.id,
          nome: e.name,
          instituicao: e.contests?.institutions?.name ?? "",
          sigla: e.contests?.institutions?.sigla ?? "",
          duracao_minutos: e.duration_minutes,
        }))
      : [],
  escolher_edital: () => ({ ok: true }),
  // Uma venda órfã de exemplo, que desaparece assim que for vinculada
  admin_unmapped_hotmart_products: () =>
    (TABLES.hotmart_products ?? []).some((p) => p.product_id === "9988776")
      ? []
      : [{ product_id: "9988776", compras: 3, ultima_compra: new Date().toISOString() }],
  resync_hotmart_enrollments: () => 0,
  admin_list_questions: () => QUESTIONS,
  admin_list_exam_questions: (args: any) => {
    const vinculos = (TABLES.exam_questions ?? []).filter((v) => v.exam_id === args?._exam_id);
    const byId = new Map(QUESTIONS.map((q) => [q.id, q]));
    return vinculos
      .filter((v) => !args?._node_ids || args._node_ids.includes(v.content_node_id))
      .map((v) => {
        const q: any = byId.get(v.question_id) ?? {};
        const no = (TABLES.content_nodes ?? []).find((n) => n.id === v.content_node_id);
        return {
          ...q,
          correct_answer: "B",
          explanation: "Comentário de teste.",
          difficulty: "medium",
          year: 2026,
          banca: "IDECAN",
          comment_image_url: null,
          content_node_id: v.content_node_id,
          content_node_name: no?.name ?? null,
          status: v.status,
          created_at: new Date().toISOString(),
        };
      })
      .filter((q: any) => !args?._search || q.statement.toLowerCase().includes(String(args._search).toLowerCase()))
      .slice(0, args?._limit ?? 200);
  },
  admin_existing_statements: (args: any) => {
    const doEdital = new Set(
      (TABLES.exam_questions ?? []).filter((v) => v.exam_id === args?._exam_id).map((v) => v.question_id),
    );
    const normaliza = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const existentes = new Set(
      QUESTIONS.filter((q) => doEdital.has(q.id)).map((q) => normaliza(q.statement)),
    );
    return (args?._statements ?? [])
      .filter((s: string) => existentes.has(normaliza(s)))
      .map((statement: string) => ({ statement }));
  },
  admin_count_questions_by_node: (args: any) => {
    const contagem: Record<string, { publicadas: number; rascunhos: number }> = {};
    for (const v of (TABLES.exam_questions ?? []).filter((x) => x.exam_id === args?._exam_id)) {
      if (!v.content_node_id) continue;
      const c = (contagem[v.content_node_id] ??= { publicadas: 0, rascunhos: 0 });
      v.status === "published" ? c.publicadas++ : c.rascunhos++;
    }
    return Object.entries(contagem).map(([content_node_id, c]) => ({ content_node_id, ...c }));
  },
};

const matches = (row: Row, filters: [string, string, any][]) =>
  filters.every(([col, op, val]) => {
    const v = row[col];
    if (op === "eq") return String(v) === String(val);
    if (op === "in") return (val as any[]).map(String).includes(String(v));
    if (op === "ilike") return String(v ?? "").toLowerCase() === String(val).toLowerCase();
    return true;
  });

class Query<T = any> implements PromiseLike<{ data: T; error: null; count: number | null }> {
  private filters: [string, string, any][] = [];
  private sort: { col: string; asc: boolean } | null = null;
  private slice: { from: number; to: number } | null = null;
  private max: number | null = null;
  private oneRow = false;
  private headOnly = false;
  private wantCount = false;
  private inserted: Row[] | null = null;
  private pending: { kind: "update"; patch: Row } | { kind: "delete" } | null = null;

  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  eq(col: string, val: any) { this.filters.push([col, "eq", val]); return this; }
  ilike(col: string, val: any) { this.filters.push([col, "ilike", val]); return this; }
  in(col: string, val: any[]) { this.filters.push([col, "in", val]); return this; }
  neq() { return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.sort = { col, asc: opts?.ascending !== false }; return this; }
  range(from: number, to: number) { this.slice = { from, to }; return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.oneRow = true; return this; }
  single() { this.oneRow = true; return this; }
  insert(rows: Row | Row[]) {
    // started_at/correct existem por default no banco; o mock precisa imitar,
    // senão o relógio do simulado nasce sem hora de início.
    const padrao = this.table === "simulado_attempts"
      ? { started_at: new Date().toISOString(), correct: 0, finished_at: null }
      : {};
    const list = (Array.isArray(rows) ? rows : [rows]).map((r, i) => ({
      id: `new-${Date.now()}-${i}`, created_at: new Date().toISOString(), ...padrao, ...r,
    }));
    (TABLES[this.table] ??= []).unshift(...list);
    this.inserted = list;
    return this;
  }
  /** Como no Postgres: substitui a linha existente pela chave, ou insere. */
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    const chave = opts?.onConflict ?? "id";
    const alvo = (TABLES[this.table] ??= []);
    const list = (Array.isArray(rows) ? rows : [rows]).map((r) => {
      const i = alvo.findIndex((x) => String(x[chave]) === String(r[chave]));
      if (i >= 0) { Object.assign(alvo[i], r); return alvo[i]; }
      const nova = { id: `new-${Date.now()}`, created_at: new Date().toISOString(), ...r };
      alvo.unshift(nova);
      return nova;
    });
    this.inserted = list;
    return this;
  }
  // update e delete só rodam no resolve: os filtros chegam DEPOIS na cadeia
  // (.update(patch).eq("id", x)), e aplicar antes atingiria a tabela inteira.
  update(patch: Row) {
    this.pending = { kind: "update", patch };
    return this;
  }
  delete() {
    this.pending = { kind: "delete" };
    return this;
  }

  private resolve() {
    if (this.pending) {
      const alvo = (TABLES[this.table] ?? []).filter((r) => matches(r, this.filters));
      if (this.pending.kind === "update") {
        const patch = this.pending.patch;
        alvo.forEach((row) => Object.assign(row, patch));
      } else {
        TABLES[this.table] = (TABLES[this.table] ?? []).filter((r) => !alvo.includes(r));
      }
      const data: any = this.oneRow ? alvo[0] ?? null : alvo;
      return { data, error: null, count: null };
    }
    if (this.inserted) {
      const data: any = this.oneRow ? this.inserted[0] ?? null : this.inserted;
      return { data, error: null, count: null };
    }
    let rows = (TABLES[this.table] ?? []).filter((r) => matches(r, this.filters));
    if (this.sort) {
      const { col, asc } = this.sort;
      rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
    }
    const count = rows.length;
    if (this.slice) rows = rows.slice(this.slice.from, this.slice.to + 1);
    if (this.max != null) rows = rows.slice(0, this.max);
    if (this.headOnly) return { data: null as any, error: null, count };
    const data: any = this.oneRow ? rows[0] ?? null : rows;
    return { data, error: null, count: this.wantCount ? count : null };
  }

  then<R1 = any, R2 = never>(
    onfulfilled?: ((v: { data: T; error: null; count: number | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.resolve() as any).then(onfulfilled as any, onrejected as any);
  }
}

const session = {
  access_token: "mock",
  user: { id: uid, email, user_metadata: { full_name: "Aluno de Teste" } },
};

export const supabase = {
  from: (table: string) => new Query(table),
  rpc: (name: string, args?: any) => Promise.resolve({ data: RPCS[name]?.(args) ?? null, error: null }),
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: session.user }, error: null }),
    onAuthStateChange: (cb: (event: string, s: any) => void) => {
      setTimeout(() => cb("SIGNED_IN", session), 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { user: session.user, session }, error: null }),
    signUp: async () => ({ data: { user: session.user, session }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: { path: "mock.png" }, error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `/${path}` } }),
    }),
  },
} as any;

if (typeof window !== "undefined") {
  console.info("[ui-mock] Supabase simulado ativo — nenhum dado real é lido ou gravado.");
}
