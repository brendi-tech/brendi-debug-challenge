// Camada PROBABILÍSTICA: só interpreta a conversa. Não valida, não precifica.
// A LLM devolve uma seleção estruturada (ids do menu); qualquer coisa que
// precise de garantia é problema da camada determinística (priceCheckout).

import type { Checkout, Conversation, Menu } from "../types";
import type { LLM } from "../llm";
import { logLLM } from "./observability";

export type Interpretation = { checkout: Checkout; clarification?: string; escalate?: { reason: string } };

// Compacta o menu pro prompt: só o que a LLM precisa pra escolher ids.
function menuForPrompt(menu: Menu) {
  return menu.products
    .filter((p) => p.active !== false)
    .map((p) => ({
      productId: p.slug,
      name: p.name,
      aliases: p.aliases ?? [],
      customs: menu.customs
        .filter((c) => p.customsPaths.includes(c.path))
        .map((c) => ({
          title: c.title,
          type: c.type,
          min: c.type === "unique" ? (c.required ? 1 : 0) : c.minChoices,
          max: c.type === "unique" ? 1 : c.maxChoices,
          choices: c.choices.map((ch) => ({ choiceId: ch.id, title: ch.title })),
        })),
    }));
}

const SYSTEM = `Você monta pedidos a partir de uma conversa de WhatsApp, usando SÓ o cardápio dado.
Devolva SOMENTE JSON:
{ "reasoning": "<1 frase: por que esses itens, ou por que clarificar/escalar>", "products": [ { "productId": "<id do cardápio>", "quantity": <inteiro>, "chosen": [ { "choiceId": "<id do cardápio>", "quantity": <inteiro, opcional> } ] } ], "clarification": "<pergunta curta, só se ambíguo>", "escalate": { "reason": "<motivo curto, só se não for pra você resolver>" } }
Regras:
- Use apenas productId/choiceId que existem no cardápio. NUNCA invente produto, opção ou preço.
- Se o cliente for ambíguo (dois produtos batem igual), deixe "products" vazio e escreva "clarification".
- Se NÃO for pra você resolver (cliente quer falar com uma pessoa/o dono, reclamação, ou algo fora do cardápio/fora de montar pedido), deixe "products" vazio e devolva "escalate" com o motivo. Escalar ≠ clarificar: clarificar é pergunta que o cliente responde; escalar é caso pra um humano.
- Complementos já inclusos (ex.: as carnes de uma marmita) também vão em "chosen".
- Um complemento pode aceitar VÁRIAS opções (veja "min"/"max"). Se o cliente citar mais de uma opção válida do mesmo grupo (ex.: "bife e frango"), inclua TODAS — não peça pra escolher uma.
- Considere a conversa inteira (o cliente pode mudar de ideia).`;

export async function interpret(
  conversation: Conversation,
  menu: Menu,
  llm: LLM
): Promise<Interpretation> {
  const convo = conversation.messages.map((m) => `${m.from}: ${m.text}`).join("\n");
  const user = `Cardápio (JSON):\n${JSON.stringify(menuForPrompt(menu))}\n\nConversa:\n${convo}`;

  const raw = await llm.chat({ system: SYSTEM, user, jsonSchemaHint: "json", temperature: 0 });

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { checkout: { products: [] }, clarification: "Não consegui entender o pedido." };
  }
  // chain-of-thought: o "porquê" da decisão, sem afetar o pedido
  if (typeof parsed.reasoning === "string" && parsed.reasoning.trim()) {
    logLLM("interpret", { reasoning: parsed.reasoning.trim() });
  }
  const escalateReason =
    parsed.escalate && typeof parsed.escalate.reason === "string" && parsed.escalate.reason.trim()
      ? parsed.escalate.reason.trim()
      : undefined;
  return {
    checkout: { products: Array.isArray(parsed.products) ? parsed.products : [] },
    clarification: typeof parsed.clarification === "string" && parsed.clarification.trim() ? parsed.clarification : undefined,
    escalate: escalateReason ? { reason: escalateReason } : undefined,
  };
}
