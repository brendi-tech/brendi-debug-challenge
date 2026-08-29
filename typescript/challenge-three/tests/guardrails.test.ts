import { describe, it, expect } from "vitest";
import { loadMenu } from "../src/menu";
import { findProduct, validateDraftItem } from "../src/guardrails";

const menu = loadMenu();

describe("findProduct", () => {
  it("resolve pelo nome", () => {
    expect(findProduct(menu, "X-Salada")?.id).toBe("x-salada");
  });

  it("resolve por alias", () => {
    expect(findProduct(menu, "completo")?.id).toBe("x-tudo");
    expect(findProduct(menu, "xis salada")?.id).toBe("x-salada");
  });

  it("retorna null pra produto inexistente", () => {
    expect(findProduct(menu, "pizza calabresa")).toBeNull();
  });
});

describe("validateDraftItem — guardrails", () => {
  it("aceita item válido e precifica pelo menu", () => {
    const r = validateDraftItem(menu, { ref: "x-salada", quantity: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.item.productId).toBe("x-salada");
      expect(r.item.unitPriceCents).toBe(2200);
      expect(r.item.lineTotalCents).toBe(2200);
    }
  });

  it("soma adicionais válidos no preço", () => {
    const r = validateDraftItem(menu, { ref: "x-salada", quantity: 2, addons: ["bacon", "ovo"] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.item.unitPriceCents).toBe(2200 + 400 + 250);
      expect(r.item.lineTotalCents).toBe((2200 + 400 + 250) * 2);
    }
  });

  it("recusa produto que não existe (nada de alucinar)", () => {
    expect(validateDraftItem(menu, { ref: "pizza", quantity: 1 }).ok).toBe(false);
  });

  it("recusa item indisponível", () => {
    expect(validateDraftItem(menu, { ref: "milkshake", quantity: 1 }).ok).toBe(false);
  });

  it("recusa quantidade inválida", () => {
    expect(validateDraftItem(menu, { ref: "x-salada", quantity: 0 }).ok).toBe(false);
  });

  it("recusa adicional que não pertence ao produto", () => {
    // x-bacon não oferece o adicional "bacon"
    expect(validateDraftItem(menu, { ref: "x-bacon", quantity: 1, addons: ["bacon"] }).ok).toBe(false);
  });
});
