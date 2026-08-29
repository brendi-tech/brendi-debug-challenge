// Orquestrador — FORNECIDO. Encadeia interpretacao (probabilistica) + montagem
// (deterministica). Nao precisa mexer.

import type { Conversation, Menu, PriceResult } from "./types";
import type { LLM } from "./llm";
import { selectProducts } from "./selectProducts";
import { priceCheckout } from "./priceCheckout";

export async function handleConversation(
  conversation: Conversation,
  menu: Menu,
  llm: LLM
): Promise<PriceResult> {
  const { checkout, clarification } = await selectProducts(conversation, menu, llm);
  if (clarification) return { ok: false, reason: "clarification", clarification };
  return priceCheckout(menu, checkout);
}
