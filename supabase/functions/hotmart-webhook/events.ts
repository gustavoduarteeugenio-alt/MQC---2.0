// Interpretação dos eventos do webhook da Hotmart (versão 2.0.0).
// Sem dependências de runtime: é importado pela Edge Function (Deno) e pelos testes (Vitest).

export type HotmartAction = "grant" | "revoke" | "ignore";

// Compra aprovada libera o acesso; reembolso e chargeback retiram.
// Demais eventos (boleto impresso, compra atrasada, cancelada antes de pagar...) só ficam registrados.
const GRANT_EVENTS = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
const REVOKE_EVENTS = new Set(["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK"]);

export type HotmartEvent = {
  eventId: string | null;
  event: string;
  action: HotmartAction;
  transaction: string | null;
  email: string | null;
  buyerName: string | null;
  productId: string | null;
  purchaseStatus: string | null;
  /** ISO 8601. Usado para descartar eventos que chegam fora de ordem. */
  eventAt: string;
  /** ISO 8601 de data.purchase.approved_date, quando vier. O prazo de acesso conta daqui. */
  approvedAt: string | null;
};

type ParseOptions = {
  /** Se não vazio, eventos de outros produtos da conta são ignorados. */
  allowedProductIds?: string[];
  now?: Date;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asText = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
};

/** Datas da Hotmart vêm em milissegundos desde a época. */
const asDate = (v: unknown): Date | null => {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const parseHotmartEvent =(body: unknown, opts: ParseOptions = {}): HotmartEvent | null => {
  if (!isObject(body)) return null;
  const event = asText(body.event)?.toUpperCase();
  if (!event) return null;

  const data = isObject(body.data) ? body.data : {};
  const buyer = isObject(data.buyer) ? data.buyer : {};
  const product = isObject(data.product) ? data.product : {};
  const purchase = isObject(data.purchase) ? data.purchase : {};

  const email = asText(buyer.email)?.toLowerCase() ?? null;
  const transaction = asText(purchase.transaction) ?? asText(purchase.transactionId);
  const productId = asText(product.id);

  let action: HotmartAction = GRANT_EVENTS.has(event) ? "grant" : REVOKE_EVENTS.has(event) ? "revoke" : "ignore";
  const allowed = opts.allowedProductIds ?? [];
  if (allowed.length > 0 && (!productId || !allowed.includes(productId))) action = "ignore";
  // Sem e-mail ou transação não há como vincular a compra a um aluno
  if (!email || !transaction) action = "ignore";

  const eventAt = asDate(body.creation_date) ?? opts.now ?? new Date();
  const approvedAt = asDate(purchase.approved_date);

  return {
    eventId: asText(body.id),
    event,
    action,
    transaction,
    email,
    buyerName: asText(buyer.name),
    productId,
    purchaseStatus: asText(purchase.status),
    eventAt: eventAt.toISOString(),
    approvedAt: approvedAt?.toISOString() ?? null,
  };
};

/** "123, 456" -> ["123", "456"] */
export const parseProductIds = (raw: string | undefined | null): string[] =>
  (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Compara o hottok recebido com o esperado sem vazar tempo proporcional ao prefixo correto. */
export const tokensMatch = (received: string | null | undefined, expected: string): boolean => {
  if (!received || !expected) return false;
  const enc = new TextEncoder();
  const a = enc.encode(received);
  const b = enc.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
};
