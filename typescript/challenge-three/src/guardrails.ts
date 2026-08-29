// ============================================================================
// NÚCLEO DETERMINÍSTICO — implemente você. SEM LLM aqui.
//
// Esta é a parte testável de verdade (TDD). Ela pega um rascunho (OrderDraft,
// que veio de algum lugar — LLM, teste, o que for) e o transforma num pedido
// VÁLIDO e PRECIFICADO, ou recusa. É aqui que mora a confiabilidade.
//
// Rode:  npm test   (os testes em tests/ definem o comportamento esperado)
// ============================================================================

import type {
  AssembleResult,
  Menu,
  MenuItem,
  OrderDraft,
  OrderItem,
  OrderDraftItem,
} from "./types";

/**
 * Resolve uma referência do cliente ("xis salada", "completo") para um item do
 * menu, considerando nome e aliases. Retorna null se não achar com segurança.
 */
export function findProduct(_menu: Menu, _ref: string): MenuItem | null {
  throw new Error("TODO: implementar findProduct");
}

/**
 * Valida e precifica UM item do rascunho contra o menu. Deve recusar:
 *  - produto que não existe no menu (nada de alucinar item);
 *  - item indisponível (available === false);
 *  - quantidade inválida (<= 0 ou absurda);
 *  - adicional que não pertence àquele produto.
 * O preço vem SEMPRE do menu — nunca confie em preço vindo do rascunho/LLM.
 *
 * Retorne { ok: true, item } ou { ok: false, reason }.
 */
export function validateDraftItem(
  _menu: Menu,
  _draftItem: OrderDraftItem
): { ok: true; item: OrderItem } | { ok: false; reason: string } {
  throw new Error("TODO: implementar validateDraftItem");
}

/**
 * Monta o pedido final a partir do rascunho:
 *  - valida/precifica cada item;
 *  - trata escolha INCLUSA vs EXTRA (ex.: marmita com 2 carnes = 1 marmita
 *    com 1 carne inclusa + 1 carne extra paga, NÃO 2 marmitas);
 *  - soma o total;
 *  - se o rascunho pediu clarificação, propague como resultado não-ok.
 */
export function assembleOrder(_menu: Menu, _draft: OrderDraft): AssembleResult {
  throw new Error("TODO: implementar assembleOrder");
}
