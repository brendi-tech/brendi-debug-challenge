// Camada DETERMINÍSTICA: valida a seleção contra o menu e precifica. Sem LLM.
// É aqui que a confiabilidade acontece — nada de confiar em produto/preço vindo
// da interpretação.

import type { Checkout, Menu, Product, ProductCustom, Result } from "../types";

const round = (n: number) => Math.round(n * 100) / 100;

export function findProduct(menu: Menu, ref: string): Product | null {
  const r = ref.toLowerCase().trim();
  return (
    menu.products.find(
      (p) =>
        p.slug.toLowerCase() === r ||
        p.name.toLowerCase() === r ||
        (p.aliases ?? []).some((a) => a.toLowerCase() === r)
    ) ?? null
  );
}

function customsOf(menu: Menu, product: Product): ProductCustom[] {
  return menu.customs.filter((c) => product.customsPaths.includes(c.path));
}

function ownerCustom(customs: ProductCustom[], choiceId: string): ProductCustom | undefined {
  return customs.find((c) => c.choices.some((x) => x.id === choiceId));
}

export function priceCheckout(menu: Menu, checkout: Checkout): Result {
  if (!checkout.products?.length) return { ok: false, reason: "pedido vazio" };

  const products: Checkout["products"] = [];
  let total = 0;

  for (const cp of checkout.products) {
    const product = findProduct(menu, cp.productId);
    if (!product) return { ok: false, reason: `produto não existe: ${cp.productId}` };
    if (product.active === false) return { ok: false, reason: `produto indisponível: ${product.slug}` };
    if (!cp.quantity || cp.quantity <= 0) return { ok: false, reason: `quantidade inválida em ${product.slug}` };

    const customs = customsOf(menu, product);
    const chosen = cp.chosen ?? [];

    // toda escolha tem que pertencer a um custom deste produto
    for (const ch of chosen) {
      if (!ownerCustom(customs, ch.choiceId)) return { ok: false, reason: `opção inválida: ${ch.choiceId} em ${product.slug}` };
    }

    // obrigatórios + min/max
    for (const c of customs) {
      const picks = chosen.filter((ch) => c.choices.some((x) => x.id === ch.choiceId));
      const count = picks.reduce((s, ch) => s + (ch.quantity ?? 1), 0);
      if (c.type === "unique" && c.required && count < 1) return { ok: false, reason: `falta escolher: ${c.title}` };
      if ((c.type === "check" || c.type === "increase")) {
        if (c.minChoices !== undefined && count < c.minChoices) return { ok: false, reason: `${c.title}: mínimo ${c.minChoices}` };
        if (c.maxChoices !== undefined && count > c.maxChoices) return { ok: false, reason: `${c.title}: máximo ${c.maxChoices}` };
      }
    }

    // preço (sempre do menu). increase com includedQuantity: as N primeiras
    // unidades do grupo são grátis, o excedente cobra extraPrice.
    let unit = product.price;
    for (const c of customs) {
      let free = c.type === "increase" ? c.includedQuantity ?? 0 : 0;
      for (const ch of chosen) {
        const choice = c.choices.find((x) => x.id === ch.choiceId);
        if (!choice) continue;
        for (let i = 0; i < (ch.quantity ?? 1); i++) {
          if (free > 0) free--;
          else unit += choice.extraPrice;
        }
      }
    }

    total += unit * cp.quantity;
    products.push({ productId: product.slug, quantity: cp.quantity, chosen, notes: cp.notes });
  }

  return { ok: true, checkout: { products, totalPrice: round(total) } };
}
