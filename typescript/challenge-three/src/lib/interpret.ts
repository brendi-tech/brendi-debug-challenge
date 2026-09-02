// Camada PROBABILÍSTICA: só interpreta a conversa. Não valida, não precifica.
// A LLM devolve uma seleção estruturada (ids do menu); qualquer coisa que
// precise de garantia é problema da camada determinística (priceCheckout).

import type { Checkout, Conversation, Menu } from "../types";
import type { LLM } from "../llm";

export type Interpretation = { checkout: Checkout; clarification?: string };

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
{ "reasoning": "<1 frase>", "products": [ { "productId": "<id>", "quantity": <int>, "chosen": [ { "choiceId": "<id>", "quantity": <int, opcional> } ] } ], "clarification": "<pergunta, só se ambíguo>" }
Regras:
- Use apenas productId/choiceId que existem no cardápio. NUNCA invente produto, opção ou preço.
- Se o cliente for ambíguo (dois produtos batem igual), deixe "products" vazio e escreva "clarification".
- Complementos já inclusos (ex.: as carnes de uma marmita) também vão em "chosen". Um complemento pode aceitar VÁRIAS opções (veja "min"/"max") — inclua todas as citadas.
- Considere a conversa inteira (o cliente pode mudar de ideia); ela tem os dois lados e pode ter horários.`;

export async function interpret(
  conversation: Conversation,
  menu: Menu,
  llm: LLM
): Promise<Interpretation> {
  // Janela de contexto: a conversa pode ser enorme (cliente antigo, sessões
  // passadas). Mando só as últimas N mensagens — o pedido atual está no fim; o
  // histórico velho é ruído e não cabe na janela do modelo.
  const RECENT = 40;
  const convo = conversation.messages
    .slice(-RECENT)
    .map((m) => `${m.at ? `[${m.at}] ` : ""}${m.from}: ${m.text}`)
    .join("\n");

  const user = `Cardápio (JSON):\n${JSON.stringify(menuForPrompt(menu))}\n\nConversa:\n${convo}`;
  const raw = await llm.chat({ system: SYSTEM, user, jsonSchemaHint: "json", temperature: 0 });

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { checkout: { products: [] }, clarification: "Não consegui entender o pedido." };
  }
  return {
    checkout: { products: Array.isArray(parsed.products) ? parsed.products : [] },
    clarification: typeof parsed.clarification === "string" && parsed.clarification.trim() ? parsed.clarification : undefined,
  };
}
