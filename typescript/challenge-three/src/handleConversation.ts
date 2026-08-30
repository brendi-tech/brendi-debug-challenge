import type { Conversation, Menu, Result } from "./types";
import type { LLM } from "./llm";

// Implemente. Veja o README e os testes (npm test / npm run test:api).
export async function handleConversation(
  _conversation: Conversation,
  _menu: Menu,
  _llm: LLM
): Promise<Result> {
  throw new Error("TODO: implementar handleConversation");
}
