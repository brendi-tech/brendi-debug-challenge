// ============================================================================
// INTERPRETAÇÃO (LLM) — implemente você. É a ÚNICA parte que fala com a LLM.
//
// Lê a conversa + o menu e produz uma SELEÇÃO estruturada (Checkout sem preço).
// Espelha o `selectProducts` do fluxo real da Brenda. A nota da precisão
// (`npm run precision`) depende de quão boa e confiável é essa interpretação.
// ============================================================================

import type { Conversation, Menu, SelectProductsResult } from "./types";
import type { LLM } from "./llm";

/**
 * Interpreta a conversa e devolve a selecao de produtos (Checkout sem
 * totalPrice). Dicas do que separa confiavel de fragil:
 *  - de a LLM so o que ela precisa (o menu relevante), peca JSON estruturado;
 *  - referencie produto/escolha por id do menu — nao deixe a LLM inventar;
 *  - sinalize ambiguidade (`clarification`) em vez de chutar quando 2 produtos
 *    batem igual (ex.: "hamburguer com bacon" entre X-Bacon e X-Salada+bacon).
 */
export async function selectProducts(
  _conversation: Conversation,
  _menu: Menu,
  _llm: LLM
): Promise<SelectProductsResult> {
  throw new Error("TODO: implementar selectProducts (a parte com LLM)");
}
