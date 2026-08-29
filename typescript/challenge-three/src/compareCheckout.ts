// ============================================================================
// compareCheckout — FORNECIDO. Versao enxuta do comparador de precisao do bot.
//
// Regra-chave (igual ao real): ASSERCAO ESPARSA. So compara os campos PRESENTES
// no `expected`. Campos undefined no expected sao ignorados, e campos extras no
// `actual` nao reprovam. Produtos casam por `productId` (ordem nao importa).
//
// `shouldBeIncluded: false` num produto/escolha inverte: passa se estiver
// AUSENTE (usado pra afirmar "nao deveria ter X").
// ============================================================================

import type { Checkout, CheckoutProduct } from "./types";

export type Detail = { path: string; status: "pass" | "fail"; message?: string };
export type ComparisonResult = { passed: boolean; details: Detail[] };

function compareProduct(exp: CheckoutProduct, act: CheckoutProduct | undefined): Detail[] {
  const path = `products.${exp.productId}`;
  const present = !!act;

  if (exp.shouldBeIncluded === false) {
    return [
      present
        ? { path, status: "fail", message: "produto deveria estar ausente" }
        : { path, status: "pass" },
    ];
  }
  if (!present) return [{ path, status: "fail", message: "produto ausente" }];

  const details: Detail[] = [];
  if (exp.quantity !== undefined && act!.quantity !== exp.quantity) {
    details.push({ path: `${path}.quantity`, status: "fail", message: `esperado ${exp.quantity}, veio ${act!.quantity}` });
  }
  for (const ec of exp.chosen ?? []) {
    const found = (act!.chosen ?? []).find((c) => c.choiceId === ec.choiceId);
    const cpath = `${path}.chosen.${ec.choiceId}`;
    if (ec.shouldBeIncluded === false) {
      details.push(found ? { path: cpath, status: "fail", message: "escolha deveria estar ausente" } : { path: cpath, status: "pass" });
      continue;
    }
    if (!found) {
      details.push({ path: cpath, status: "fail", message: "escolha ausente" });
    } else if (ec.quantity !== undefined && found.quantity !== ec.quantity) {
      details.push({ path: `${cpath}.quantity`, status: "fail", message: `esperado ${ec.quantity}, veio ${found.quantity}` });
    }
  }
  if (details.length === 0) details.push({ path, status: "pass" });
  return details;
}

export function compareCheckout(expected: Checkout, actual: Checkout): ComparisonResult {
  const details: Detail[] = [];

  if (expected.products) {
    const pool = [...(actual.products ?? [])];
    for (const exp of expected.products) {
      const idx = pool.findIndex((p) => p.productId === exp.productId);
      const act = idx >= 0 ? pool[idx] : undefined;
      if (idx >= 0 && exp.shouldBeIncluded !== false) pool.splice(idx, 1);
      details.push(...compareProduct(exp, act));
    }
  }

  if (expected.totalPrice !== undefined) {
    details.push(
      actual.totalPrice === expected.totalPrice
        ? { path: "totalPrice", status: "pass" }
        : { path: "totalPrice", status: "fail", message: `esperado ${expected.totalPrice}, veio ${actual.totalPrice}` }
    );
  }

  return { passed: details.every((d) => d.status === "pass"), details };
}
