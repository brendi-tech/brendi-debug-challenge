import type { Conversation, Menu, Result } from "./types";
import type { LLM } from "./llm";

/**
 * O coração do desafio — implemente você, do seu jeito.
 *
 * Recebe a conversa e o cardápio, e devolve o pedido montado (um `Checkout` com
 * `totalPrice`) — ou uma recusa quando o pedido é inválido / ambíguo demais.
 *
 * `llm.chat(...)` te dá acesso à LLM (devolve texto). Como você organiza o
 * pipeline por dentro (o que delega pra LLM, o que você garante em código, como
 * valida e precifica) é decisão sua. Os testes definem o comportamento esperado:
 *
 *   npm test            -> comportamento determinístico (LLM controlada)
 *   npm run precision    -> qualidade da interpretação com a LLM real
 */
export async function handleConversation(
  _conversation: Conversation,
  _menu: Menu,
  _llm: LLM
): Promise<Result> {
  throw new Error("TODO: implementar handleConversation");
}
