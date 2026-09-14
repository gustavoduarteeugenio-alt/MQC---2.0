import { describe, expect, it } from "vitest";
import { parseHotmartEvent, parseProductIds, tokensMatch } from "./events";

const payload = (overrides: { event?: string; data?: Record<string, unknown>; [k: string]: unknown } = {}) => ({
  id: "evt-1",
  creation_date: 1757800000000,
  event: "PURCHASE_APPROVED",
  version: "2.0.0",
  ...overrides,
  data: {
    product: { id: 123456, name: "Método Questão Certa" },
    buyer: { email: "Aluno@Example.com ", name: "Aluno Teste" },
    purchase: { transaction: "HP123", status: "APPROVED", approved_date: 1757790000000 },
    ...(overrides.data ?? {}),
  },
});

describe("parseHotmartEvent", () => {
  it("libera acesso em compra aprovada e normaliza os campos", () => {
    expect(parseHotmartEvent(payload())).toEqual({
      eventId: "evt-1",
      event: "PURCHASE_APPROVED",
      action: "grant",
      transaction: "HP123",
      email: "aluno@example.com",
      buyerName: "Aluno Teste",
      productId: "123456",
      purchaseStatus: "APPROVED",
      eventAt: new Date(1757800000000).toISOString(),
      approvedAt: new Date(1757790000000).toISOString(),
    });
  });

  it("approvedAt fica nulo quando approved_date não vem ou é inválido", () => {
    expect(parseHotmartEvent(payload({ data: { purchase: { transaction: "HP1" } } }))?.approvedAt).toBeNull();
    expect(
      parseHotmartEvent(payload({ data: { purchase: { transaction: "HP1", approved_date: "ontem" } } }))?.approvedAt,
    ).toBeNull();
  });

  it("PURCHASE_COMPLETE também libera", () => {
    expect(parseHotmartEvent(payload({ event: "PURCHASE_COMPLETE" }))?.action).toBe("grant");
  });

  it.each(["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK"])("%s retira o acesso", (event) => {
    expect(parseHotmartEvent(payload({ event }))?.action).toBe("revoke");
  });

  it.each(["PURCHASE_BILLET_PRINTED", "PURCHASE_DELAYED", "PURCHASE_CANCELED", "PURCHASE_PROTEST"])(
    "%s só é registrado",
    (event) => {
      expect(parseHotmartEvent(payload({ event }))?.action).toBe("ignore");
    },
  );

  it("aceita nome de evento em minúsculas", () => {
    expect(parseHotmartEvent(payload({ event: "purchase_approved" }))?.action).toBe("grant");
  });

  it("usa purchase.transactionId quando transaction não vem", () => {
    const evt = parseHotmartEvent(payload({ data: { purchase: { transactionId: "HP999" } } }));
    expect(evt?.transaction).toBe("HP999");
    expect(evt?.action).toBe("grant");
  });

  it("ignora eventos sem e-mail ou sem transação", () => {
    expect(parseHotmartEvent(payload({ data: { buyer: { name: "Sem email" } } }))?.action).toBe("ignore");
    expect(parseHotmartEvent(payload({ data: { purchase: { status: "APPROVED" } } }))?.action).toBe("ignore");
  });

  it("ignora produtos fora da lista permitida", () => {
    expect(parseHotmartEvent(payload(), { allowedProductIds: ["999"] })?.action).toBe("ignore");
    expect(parseHotmartEvent(payload(), { allowedProductIds: ["999", "123456"] })?.action).toBe("grant");
  });

  it("sem lista de produtos, qualquer produto libera", () => {
    expect(parseHotmartEvent(payload(), { allowedProductIds: [] })?.action).toBe("grant");
  });

  it("usa o horário atual quando creation_date não vem", () => {
    const now = new Date("2026-09-14T12:00:00Z");
    const evt = parseHotmartEvent(payload({ creation_date: undefined }), { now });
    expect(evt?.eventAt).toBe(now.toISOString());
  });

  it("rejeita corpos inválidos", () => {
    expect(parseHotmartEvent(null)).toBeNull();
    expect(parseHotmartEvent("PURCHASE_APPROVED")).toBeNull();
    expect(parseHotmartEvent([])).toBeNull();
    expect(parseHotmartEvent({ data: {} })).toBeNull();
    expect(parseHotmartEvent({ event: "   " })).toBeNull();
  });
});

describe("parseProductIds", () => {
  it("separa por vírgula e descarta vazios", () => {
    expect(parseProductIds(" 123, 456 ,,")).toEqual(["123", "456"]);
    expect(parseProductIds(undefined)).toEqual([]);
    expect(parseProductIds("")).toEqual([]);
  });
});

describe("tokensMatch", () => {
  it("aceita só o token exato", () => {
    expect(tokensMatch("abc123", "abc123")).toBe(true);
    expect(tokensMatch("abc124", "abc123")).toBe(false);
    expect(tokensMatch("abc12", "abc123")).toBe(false);
    expect(tokensMatch("abc1234", "abc123")).toBe(false);
  });

  it("recusa token ausente ou esperado vazio", () => {
    expect(tokensMatch(null, "abc")).toBe(false);
    expect(tokensMatch(undefined, "abc")).toBe(false);
    expect(tokensMatch("", "")).toBe(false);
  });
});
