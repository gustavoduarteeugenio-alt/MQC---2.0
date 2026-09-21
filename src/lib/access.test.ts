import { describe, expect, it } from "vitest";
import { accessUntilFrom, hasActiveAccess, isAccessExpired, isStaff } from "./access";

const now = new Date("2026-09-14T12:00:00Z");

describe("hasActiveAccess", () => {
  it("nega sem perfil ou sem aprovação", () => {
    expect(hasActiveAccess(null, now)).toBe(false);
    expect(hasActiveAccess(undefined, now)).toBe(false);
    expect(hasActiveAccess({ approved: false, access_until: "2027-01-01T00:00:00Z" }, now)).toBe(false);
    expect(hasActiveAccess({ approved: null }, now)).toBe(false);
  });

  it("liberação sem prazo vale sempre", () => {
    expect(hasActiveAccess({ approved: true, access_until: null }, now)).toBe(true);
    expect(hasActiveAccess({ approved: true }, now)).toBe(true);
  });

  it("respeita o prazo", () => {
    expect(hasActiveAccess({ approved: true, access_until: "2026-09-14T12:00:01Z" }, now)).toBe(true);
    expect(hasActiveAccess({ approved: true, access_until: "2026-09-14T12:00:00Z" }, now)).toBe(false);
    expect(hasActiveAccess({ approved: true, access_until: "2025-09-14T12:00:00Z" }, now)).toBe(false);
  });
});

describe("isAccessExpired", () => {
  it("só é expirado quando estava liberado e o prazo passou", () => {
    expect(isAccessExpired({ approved: true, access_until: "2025-01-01T00:00:00Z" }, now)).toBe(true);
    expect(isAccessExpired({ approved: true, access_until: "2027-01-01T00:00:00Z" }, now)).toBe(false);
    expect(isAccessExpired({ approved: true, access_until: null }, now)).toBe(false);
    expect(isAccessExpired({ approved: false, access_until: "2025-01-01T00:00:00Z" }, now)).toBe(false);
    expect(isAccessExpired(null, now)).toBe(false);
  });
});

describe("isStaff", () => {
  it("reconhece admin e admin didatico", () => {
    expect(isStaff(["user", "admin"])).toBe(true);
    expect(isStaff(["admin_didatico"])).toBe(true);
  });

  it("nega aluno comum e listas vazias", () => {
    expect(isStaff(["user"])).toBe(false);
    expect(isStaff([])).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
    expect(isStaff([null, undefined])).toBe(false);
  });
});

describe("accessUntilFrom", () => {
  it("soma 1 ano", () => {
    expect(accessUntilFrom(now)).toBe("2027-09-14T12:00:00.000Z");
  });

  it("não altera a data de entrada", () => {
    const start = new Date(now);
    accessUntilFrom(start);
    expect(start.toISOString()).toBe(now.toISOString());
  });
});
