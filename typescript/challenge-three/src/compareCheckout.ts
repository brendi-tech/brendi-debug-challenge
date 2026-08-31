// NÃO MEXER — utilitário fornecido (comparador dos testes).
// Comparação esparsa: só assere os campos presentes no `expected`.

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

  if (expected.address?.label !== undefined) {
    const got = actual.address?.label;
    details.push(
      got === expected.address.label
        ? { path: "address.label", status: "pass" }
        : { path: "address.label", status: "fail", message: `esperado ${JSON.stringify(expected.address.label)}, veio ${JSON.stringify(got)}` }
    );
  }
  if (expected.address?.text !== undefined) {
    // endereço é texto livre: normaliza (pontuação/caixa/espaços) e checa se contém.
    const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[.,\-\/]/g, " ").replace(/\s+/g, " ").trim();
    const got = actual.address?.text;
    details.push(
      norm(got).includes(norm(expected.address.text))
        ? { path: "address.text", status: "pass" }
        : { path: "address.text", status: "fail", message: `esperado conter ${JSON.stringify(expected.address.text)}, veio ${JSON.stringify(got)}` }
    );
  }

  if (expected.payment) {
    for (const k of ["method", "changeFor"] as const) {
      if (expected.payment[k] === undefined) continue;
      const got = actual.payment?.[k];
      details.push(
        got === expected.payment[k]
          ? { path: `payment.${k}`, status: "pass" }
          : { path: `payment.${k}`, status: "fail", message: `esperado ${JSON.stringify(expected.payment[k])}, veio ${JSON.stringify(got)}` }
      );
    }
  }

  return { passed: details.every((d) => d.status === "pass"), details };
}
