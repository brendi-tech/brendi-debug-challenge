// ============================================================================
// INTERPRETAÇÃO (LLM) + ORQUESTRAÇÃO — implemente você.
//
// `interpret` é a única parte que fala com a LLM. Ela lê a conversa + o menu e
// produz um OrderDraft ESTRUTURADO. Pense bem no prompt e em como forçar uma
// saída confiável (a nota do eval depende disso).
//
// `handleConversation` só encadeia: interpret -> assembleOrder (determinístico).
//
// Rode:  npm run eval   (mede a precisão da sua interpretação nos casos reais)
// ============================================================================

import type { AssembleResult, Conversation, Menu, OrderDraft } from "./types";
import type { LLM } from "./llm";
import { assembleOrder } from "./guardrails";

/**
 * Interpreta a conversa e devolve um rascunho estruturado do pedido.
 * Dicas do que separa um pipeline confiável de um frágil:
 *  - dê à LLM só o que ela precisa (o menu relevante), peça JSON;
 *  - não deixe a LLM inventar preço nem produto fora do menu;
 *  - sinalize ambiguidade (clarificationNeeded) em vez de chutar.
 */
export async function interpret(
  _conversation: Conversation,
  _menu: Menu,
  _llm: LLM
): Promise<OrderDraft> {
  throw new Error("TODO: implementar interpret (a parte com LLM)");
}

/** Encadeia interpretação (probabilística) + montagem (determinística). */
export async function handleConversation(
  conversation: Conversation,
  menu: Menu,
  llm: LLM
): Promise<AssembleResult> {
  const draft = await interpret(conversation, menu, llm);
  return assembleOrder(menu, draft);
}
