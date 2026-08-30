// SOLUÇÃO DE REFERÊNCIA.
//
// A decisão de design central: separar o probabilístico do determinístico.
//   - interpret  -> só a LLM. Traduz a conversa numa seleção estruturada (ids).
//   - priceCheckout -> sem LLM. Valida contra o menu e precifica. Confiável e
//     testável de forma binária.
// Assim os testes conseguem ser determinísticos (controlando/injetando a LLM) e
// a parte que "não pode sair errado" nunca depende do modelo.

import type { Conversation, Menu, Result } from "./types";
import type { LLM } from "./llm";
import { interpret } from "./lib/interpret";
import { priceCheckout } from "./lib/priceCheckout";
import { notifyOwner } from "./lib/notifyOwner";

export async function handleConversation(
  conversation: Conversation,
  menu: Menu,
  llm: LLM
): Promise<Result> {
  const { checkout, clarification, escalate } = await interpret(conversation, menu, llm);
  // nao e pra Brenda resolver -> aciona o dono e encerra o turno dela
  if (escalate) {
    await notifyOwner({ storeId: conversation.storeId, reason: escalate.reason, messages: conversation.messages });
    return { ok: false, escalated: true, reason: escalate.reason };
  }
  if (clarification) return { ok: false, clarification };
  return priceCheckout(menu, checkout);
}
