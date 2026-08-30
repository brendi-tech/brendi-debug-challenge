import { describe, it, expect } from "vitest";
import { loadMenu } from "../src/menu";
import { makeFakeLLM } from "../src/llm";
import { handleConversation } from "../src/handleConversation";
import type { Checkout } from "../src/types";

// makeFakeLLM devolve a seleção que você mandar → comportamento determinístico.

const menu = loadMenu();
const convo = { storeId: menu.storeId, messages: [{ from: "customer" as const, text: "..." }] };
const run = (selection: Checkout) => handleConversation(convo, menu, makeFakeLLM(selection));

describe("recusas (guardrails)", () => {
  it("produto que não existe no menu", async () => {
    expect((await run({ products: [{ productId: "pizza", quantity: 1 }] })).ok).toBe(false);
  });
  it("produto inativo", async () => {
    expect((await run({ products: [{ productId: "milkshake", quantity: 1 }] })).ok).toBe(false);
  });
  it("quantidade inválida", async () => {
    expect((await run({ products: [{ productId: "x-salada", quantity: 0 }] })).ok).toBe(false);
  });
  it("escolha que não pertence ao produto", async () => {
    expect((await run({ products: [{ productId: "x-bacon", quantity: 1, chosen: [{ choiceId: "bacon" }] }] })).ok).toBe(false);
  });
  it("custom obrigatório sem escolha (batata sem tamanho)", async () => {
    expect((await run({ products: [{ productId: "batata", quantity: 1 }] })).ok).toBe(false);
  });
  it("um item inválido reprova o pedido inteiro", async () => {
    const r = await run({ products: [{ productId: "x-salada", quantity: 1 }, { productId: "milkshake", quantity: 1 }] });
    expect(r.ok).toBe(false);
  });
});

describe("precificação (preço sempre do menu)", () => {
  it("item simples", async () => {
    const r = await run({ products: [{ productId: "x-salada", quantity: 1 }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.checkout.totalPrice).toBeCloseTo(22, 2);
  });

  it("adicionais somam", async () => {
    const r = await run({ products: [{ productId: "x-salada", quantity: 1, chosen: [{ choiceId: "bacon" }, { choiceId: "ovo" }] }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.checkout.totalPrice).toBeCloseTo(22 + 4 + 2.5, 2);
  });

  it("quantidade multiplica", async () => {
    const r = await run({ products: [{ productId: "refri", quantity: 2, chosen: [{ choiceId: "coca" }] }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.checkout.totalPrice).toBeCloseTo(14, 2);
  });

  it("marmita com 2 carnes = 1 inclusa + 1 extra, NÃO 2 marmitas", async () => {
    const r = await run({
      products: [{ productId: "marmita", quantity: 1, chosen: [{ choiceId: "bife", quantity: 1 }, { choiceId: "frango", quantity: 1 }] }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.checkout.products).toHaveLength(1);
      expect(r.checkout.products[0].quantity).toBe(1);
      expect(r.checkout.totalPrice).toBeCloseTo(28 + 9, 2);
    }
  });
});
