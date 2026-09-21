// Regra de acesso ao app — espelha check_account_approved no banco.
// O curso dá 1 ano de acesso; access_until nulo = liberação antiga, sem prazo.

export const ACCESS_DURATION_YEARS = 1;

export type AccessFields = {
  approved?: boolean | null;
  access_until?: string | null;
};

export const hasActiveAccess = (p: AccessFields | null | undefined, now: Date = new Date()): boolean => {
  if (!p || p.approved !== true) return false;
  if (!p.access_until) return true;
  return new Date(p.access_until).getTime() > now.getTime();
};

/** Liberado, mas o prazo de 1 ano já terminou. */
export const isAccessExpired = (p: AccessFields | null | undefined, now: Date = new Date()): boolean =>
  !!p?.approved && !!p.access_until && new Date(p.access_until).getTime() <= now.getTime();

/** Fim do acesso para uma liberação feita agora (ex.: aprovação manual pelo admin). */
export const accessUntilFrom = (start: Date = new Date()): string => {
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + ACCESS_DURATION_YEARS);
  return end.toISOString();
};

export const formatAccessDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Papéis que acessam o app sem compra (mesma regra do ProtectedRoute). */
export const isStaff = (roles: (string | null | undefined)[] | null | undefined): boolean =>
  (roles ?? []).some((r) => r === "admin" || r === "admin_didatico");
