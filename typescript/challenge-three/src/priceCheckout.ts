// ============================================================================
// CAMADA DETERMINÍSTICA — implemente você. SEM LLM aqui.
//
// Pega um Checkout (selecao vinda do selectProducts ou de um teste), valida
// contra o menu e devolve o mesmo Checkout precificado (`totalPrice`), ou recusa.
// É aqui que mora a confiabilidade — e é o que os testes (`npm test`) cobrem.
// ============================================================================

import type { Checkout, Menu, PriceResult, Product } from "./types";

/**
 * Resolve uma referencia do cliente ("xis salada", "completo") ou um slug para
 * um produto do menu (por slug, nome ou alias). Retorna null se nao achar.
 */
export function findProduct(_menu: Menu, _ref: string): Product | null {
  throw new Error("TODO: implementar findProduct");
}

/**
 * Valida e precifica o Checkout inteiro. Recuse (ok:false) quando:
 *  - produto nao existe no menu (nada de alucinar);
 *  - produto inativo (active === false);
 *  - quantidade invalida (<= 0);
 *  - um complemento escolhido nao pertence aos customs daquele produto;
 *  - um custom `unique` obrigatorio (required) ficou sem escolha;
 *  - min/maxChoices violado.
 *
 * Precificacao (preco SEMPRE do menu, nunca do que veio da LLM):
 *  - por item: product.price + soma dos extraPrice das escolhas;
 *  - custom `increase` com `includedQuantity`: as N primeiras escolhas do grupo
 *    sao gratis; o excedente cobra extraPrice (ex.: marmita com 2 carnes = 1
 *    inclusa + 1 extra paga);
 *  - totalPrice = soma de (quantidade * preco unitario) de todos os itens.
 *
 * Devolve o Checkout com `totalPrice` preenchido.
 */
export function priceCheckout(_menu: Menu, _checkout: Checkout): PriceResult {
  throw new Error("TODO: implementar priceCheckout");
}
