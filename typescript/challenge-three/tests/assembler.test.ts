import { describe, it, expect } from "vitest";
import { loadMenu } from "../src/menu";
import { assembleOrder } from "../src/guardrails";
import type { OrderDraft } from "../src/types";

const menu = loadMenu();

describe("assembleOrder", () => {
  it("monta um pedido simples e soma o total", () => {
    const draft: OrderDraft = { items: [{ ref: "x-salada", quantity: 1 }] };
    const r = assembleOrder(menu, draft);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.order.items).toHaveLength(1);
      expect(r.order.totalCents).toBe(2200);
    }
  });

  it("soma múltiplos itens com adicionais", () => {
    const draft: OrderDraft = {
      items: [
        { ref: "x-salada", quantity: 1, addons: ["bacon"] }, // 2600
        { ref: "batata", quantity: 1, choice: "M" }, // 1500 + 500
        { ref: "refri", quantity: 2, choice: "coca" }, // 700 * 2
      ],
    };
    const r = assembleOrder(menu, draft);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.totalCents).toBe(2600 + 2000 + 1400);
  });

  // O CASO QUE SEPARA — incluso vs extra.
  it("marmita com 2 carnes = 1 marmita (1 inclusa) + 1 carne extra, NÃO 2 marmitas", () => {
    const draft: OrderDraft = {
      items: [{ ref: "marmita", quantity: 1, includedPicks: ["bife", "frango"] }],
    };
    const r = assembleOrder(menu, draft);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.order.items).toHaveLength(1);
      const item = r.order.items[0];
      expect(item.productId).toBe("marmita");
      expect(item.quantity).toBe(1);
      // 2800 (marmita, 1 carne inclusa) + 900 (1 carne extra)
      expect(item.unitPriceCents).toBe(2800 + 900);
      expect(r.order.totalCents).toBe(3700);
    }
  });

  it("propaga clarificação quando o rascunho pede", () => {
    const draft: OrderDraft = { items: [], clarificationNeeded: "Qual hambúrguer?" };
    const r = assembleOrder(menu, draft);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.clarification).toBeTruthy();
  });

  it("recusa o pedido inteiro se um item é inválido", () => {
    const draft: OrderDraft = {
      items: [
        { ref: "x-salada", quantity: 1 },
        { ref: "milkshake", quantity: 1 }, // indisponível
      ],
    };
    expect(assembleOrder(menu, draft).ok).toBe(false);
  });
});
