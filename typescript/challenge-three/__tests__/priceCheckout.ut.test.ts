import { describe, it, expect } from "vitest";
import { loadMenu } from "../src/menu";
import { findProduct, priceCheckout } from "../src/priceCheckout";
import type { Checkout } from "../src/types";

const menu = loadMenu();
const co = (products: Checkout["products"]): Checkout => ({ products });

describe("findProduct", () => {
  it("resolve por nome", () => {
    expect(findProduct(menu, "X-Salada")?.slug).toBe("x-salada");
  });
  it("resolve por alias", () => {
    expect(findProduct(menu, "completo")?.slug).toBe("x-tudo");
  });
  it("retorna null pra produto inexistente", () => {
    expect(findProduct(menu, "pizza calabresa")).toBeNull();
  });
});

describe("priceCheckout — guardrails", () => {
  it("recusa produto que não existe (nada de alucinar)", () => {
    expect(priceCheckout(menu, co([{ productId: "pizza", quantity: 1 }])).ok).toBe(false);
  });
  it("recusa produto inativo", () => {
    expect(priceCheckout(menu, co([{ productId: "milkshake", quantity: 1 }])).ok).toBe(false);
  });
  it("recusa quantidade inválida", () => {
    expect(priceCheckout(menu, co([{ productId: "x-salada", quantity: 0 }])).ok).toBe(false);
  });
  it("recusa escolha que não pertence aos customs do produto", () => {
    // x-bacon não tem custom nenhum, então "bacon" é inválido nele
    const r = priceCheckout(menu, co([{ productId: "x-bacon", quantity: 1, chosen: [{ choiceId: "bacon" }] }]));
    expect(r.ok).toBe(false);
  });
  it("recusa quando um custom obrigatório (unique required) fica sem escolha", () => {
    // batata exige tamanho
    expect(priceCheckout(menu, co([{ productId: "batata", quantity: 1 }])).ok).toBe(false);
  });
});

describe("priceCheckout — precificação (preço sempre do menu)", () => {
  it("item simples", () => {
    const r = priceCheckout(menu, co([{ productId: "x-salada", quantity: 1 }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.checkout.totalPrice).toBeCloseTo(22, 2);
  });

  it("soma adicionais válidos", () => {
    const r = priceCheckout(menu, co([{ productId: "x-salada", quantity: 1, chosen: [{ choiceId: "bacon" }, { choiceId: "ovo" }] }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.checkout.totalPrice).toBeCloseTo(22 + 4 + 2.5, 2);
  });

  it("múltiplos itens com escolhas e quantidade", () => {
    const r = priceCheckout(
      menu,
      co([
        { productId: "x-salada", quantity: 1, chosen: [{ choiceId: "bacon" }] }, // 26
        { productId: "batata", quantity: 1, chosen: [{ choiceId: "m" }] }, // 20
        { productId: "refri", quantity: 2, chosen: [{ choiceId: "coca" }] }, // 14
      ])
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.checkout.totalPrice).toBeCloseTo(26 + 20 + 14, 2);
  });

  // O CASO QUE SEPARA — incluso vs extra.
  it("marmita com 2 carnes = 1 inclusa + 1 extra paga, NÃO 2 marmitas", () => {
    const r = priceCheckout(
      menu,
      co([{ productId: "marmita", quantity: 1, chosen: [{ choiceId: "bife", quantity: 1 }, { choiceId: "frango", quantity: 1 }] }])
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.checkout.products).toHaveLength(1);
      expect(r.checkout.products[0].quantity).toBe(1);
      // 28 (marmita, 1 carne inclusa) + 9 (1 carne extra)
      expect(r.checkout.totalPrice).toBeCloseTo(37, 2);
    }
  });

  it("recusa o pedido inteiro se um item é inválido", () => {
    const r = priceCheckout(menu, co([{ productId: "x-salada", quantity: 1 }, { productId: "milkshake", quantity: 1 }]));
    expect(r.ok).toBe(false);
  });
});
