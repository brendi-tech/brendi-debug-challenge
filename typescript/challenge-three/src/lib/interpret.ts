// Camada PROBABILÍSTICA: só interpreta a conversa. Não valida, não precifica.
// A LLM devolve uma seleção estruturada (ids do menu); qualquer coisa que
// precise de garantia é problema da camada determinística (priceCheckout).

import type { Checkout, Conversation, DeliveryAddress, Menu, Payment } from "../types";
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
{ "reasoning": "<1 frase>", "products": [ { "productId": "<id>", "quantity": <int>, "chosen": [ { "choiceId": "<id>", "quantity": <int, opcional> } ] } ], "clarification": "<pergunta, só se ambíguo>", "escalate": { "reason": "<motivo, só se não for pra você resolver>" }, "address": { "label": "<apelido de endereço salvo, se o cliente usou um>", "text": "<endereço, se ditou um novo>" }, "payment": { "method": "pix|dinheiro|credito|debito", "changeFor": <número, só se dinheiro> }, "reuseLastOrder": <true, só se o cliente pediu "o de sempre"/repetir e existir um último pedido> }
Regras:
- Use apenas productId/choiceId que existem no cardápio. NUNCA invente produto, opção ou preço.
- Se o cliente for ambíguo (dois produtos batem igual), deixe "products" vazio e escreva "clarification".
- Se NÃO for pra você resolver (cliente quer falar com uma pessoa/o dono, reclamação, ou algo fora do cardápio/fora de montar pedido), deixe "products" vazio e devolva "escalate". Escalar ≠ clarificar.
- Complementos já inclusos (ex.: as carnes de uma marmita) também vão em "chosen". Um complemento pode aceitar VÁRIAS opções (veja "min"/"max") — inclua todas as citadas.
- Endereço: se o cliente referir um endereço SALVO (ex.: "manda pra casa"), devolva só o "label" (ex.: "casa") — o texto é resolvido do lado do sistema. Se ditar um endereço novo, devolva "text". Só inclua "address" se houver entrega.
- Pagamento: só inclua "payment" se o cliente disse a forma. Use só métodos aceitos. "troco pra X" → changeFor: X (só dinheiro).
- Reaproveitar: se o cliente pedir o último pedido ("o de sempre", "repete o de ontem") e existir um "Último pedido" no contexto, devolva "reuseLastOrder": true.
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

  const parts = [
    `Cardápio (JSON):\n${JSON.stringify(menuForPrompt(menu))}`,
    `Formas de pagamento aceitas: ${menu.acceptedPayments.join(", ")}`,
  ];
  const cust = conversation.customer;
  if (cust?.addresses?.length) parts.push(`Endereços salvos: ${JSON.stringify(cust.addresses)}`);
  if (cust?.lastOrder) parts.push(`Último pedido do cliente: ${JSON.stringify({ products: cust.lastOrder.products })}`);
  parts.push(`Conversa:\n${convo}`);

  const raw = await llm.chat({ system: SYSTEM, user: parts.join("\n\n"), jsonSchemaHint: "json", temperature: 0 });

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { checkout: { products: [] }, clarification: "Não consegui entender o pedido." };
  }
  if (typeof parsed.reasoning === "string" && parsed.reasoning.trim()) {
    logLLM("interpret", { reasoning: parsed.reasoning.trim() });
  }

  // Endereço: resolvo o apelido salvo AQUI (não confio na LLM copiar o texto certo).
  let address: DeliveryAddress | undefined;
  if (parsed.address) {
    const saved = cust?.addresses?.find((a) => a.label === parsed.address.label);
    if (saved) address = { label: saved.label, text: saved.text };
    else if (typeof parsed.address.text === "string" && parsed.address.text.trim()) address = { text: parsed.address.text.trim() };
  }

  const payment: Payment | undefined =
    parsed.payment && typeof parsed.payment.method === "string"
      ? { method: parsed.payment.method, changeFor: typeof parsed.payment.changeFor === "number" ? parsed.payment.changeFor : undefined }
      : undefined;

  // Reaproveitar último pedido: copio os produtos dele AQUI, não deixo a LLM redigitar.
  const reuse = parsed.reuseLastOrder === true && cust?.lastOrder;
  const products = reuse ? cust!.lastOrder!.products : Array.isArray(parsed.products) ? parsed.products : [];

  const escalateReason =
    parsed.escalate && typeof parsed.escalate.reason === "string" && parsed.escalate.reason.trim()
      ? parsed.escalate.reason.trim()
      : undefined;

  return {
    checkout: { products, address, payment },
    clarification: typeof parsed.clarification === "string" && parsed.clarification.trim() ? parsed.clarification : undefined,
    escalate: escalateReason ? { reason: escalateReason } : undefined,
  };
}
