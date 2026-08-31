# Desafio Técnico — Brenda: montar o pedido a partir da conversa (TypeScript)

> Nível **pleno**. Take-home assíncrono. Depois marcamos uma conversa curta pra
> você apresentar e a gente estender junto.

## Contexto

Na Brendi, a **Brenda** é a IA que atende no WhatsApp e monta o pedido do cliente
pra milhares de restaurantes. O coração disso é pegar uma conversa em linguagem
natural, cruzar com o cardápio da loja e produzir um **pedido correto** — de
forma **confiável**, apesar de a LLM ser probabilística.

Este desafio é uma versão mínima e honesta desse problema. Os tipos espelham o
nosso código real: um `Menu` de listas planas (`products` / `customs`) e um
`Checkout` como pedido montado.

## A missão

Implemente **uma** função:

```ts
handleConversation(conversation, menu, llm): Promise<Result>
```

Ela recebe a conversa e o cardápio e devolve o pedido montado (um `Checkout` com
`totalPrice`), ou uma recusa quando for inválido / ambíguo — ou **escala pro dono
do restaurante** quando não é pra Brenda resolver (ver abaixo). **Como você organiza
o pipeline por dentro é decisão sua** — o que delega pra LLM, o que garante em
código, como valida e precifica. O stub está em `src/handleConversation.ts`.

O pedido completo inclui **endereço** e **forma de pagamento** (`Checkout.address`,
`Checkout.payment`). E o input pode trazer **contexto do cliente**
(`Conversation.customer`: endereços salvos, último pedido) — o cliente pode dizer
"manda pra casa" ou "manda o de sempre". A conversa tem os dois lados (`customer` /
`store`) e pode ser longa.

Ela é servida por uma **API HTTP** (`src/app.ts`, Express) — é assim que o harness
bate nela, como na Brenda real:

| Rota | O quê |
|---|---|
| `GET /` | vem pronto — responde `{ ok: true }` quando o server sobe |
| `POST /orders` | body `{ messages, customer? }` → devolve o `Result` (vem ligado ao `handleConversation`) |
| `POST /owner/notify` | **você cria** — recebe a escalação pro dono |

Não tem roteiro: **os testes são a especificação.** Faça-os passar e maximize a
precisão.

## Como rodar

```bash
npm install
```

**Enquanto você desenvolve** — instantâneo, sem server e sem chave. É o seu loop:

```bash
npm test              # contrato determinístico: LLM controlada testa preço/guardrails
```

**Pra ver o real end-to-end** — precisa da chave (`cp .env.example .env`) e de **dois
terminais**:

```bash
# terminal 1 — sobe a API em http://localhost:5052
npm start
# terminal 2 — bate nos endpoints por HTTP e pontua a precisão (LLM real)
npm run test:api
```

Por que dois: `npm test` roda a lógica com uma **LLM de teste** (`makeFakeLLM`), então
é determinístico, grátis e instantâneo — dá pra testar até o que a LLM real nunca
faria de propósito (produto inválido, etc.). `npm run test:api` usa a **LLM de
verdade** contra o server no ar: a precisão do `/orders` é uma **nota** (maximize), o
resto (`/`, `/owner/notify`) é pass/fail.

## Requisitos

Além de fazer os testes passarem:

- **Escalação.** Quando não é pra Brenda resolver (o cliente quer falar com uma
  pessoa, uma reclamação, algo fora do cardápio), acione o dono por uma **chamada
  HTTP**: adicione `POST /owner/notify` no `app.ts` e faça o pipeline chamá-lo. Trate
  a falha da chamada sem derrubar o atendimento.
- **Observabilidade.** Instrumente as chamadas de LLM (o que entrou, o que o modelo
  decidiu, tokens, latência) e **persista esse rastro num arquivo** — não só no
  console.

## O que já vem pronto

`src/types.ts` (contratos), `src/menu.ts` (loader), `src/llm.ts` (wrapper da LLM +
`makeFakeLLM`), `data/menu.json` (cardápio), a **API** `src/app.ts` (Express, com
`/` + `/orders` já ligados), e os harnesses `npm test` (in-process) e
`npm run test:api` (bate no server). O resto é com você.

**Não mexa** (têm um aviso no topo): `test_endpoints.ts`, `cases.json`,
`__tests__/behaviour.test.ts`, `src/menu.ts`, `src/compareCheckout.ts` — é o que te
valida. Seu território: `src/handleConversation.ts` (implemente), `src/app.ts`
(estenda) e o que mais você criar.

## Entrega

- `handleConversation` implementado, `npm test` verde.
- Um **`SOLUTION.md`** curto: decisões, tradeoffs, e uma seção **"em escala"** — o
  que você faria com mais tempo / mais volume.

**Time-box sugerido: 3–4h.** Foco e julgamento valem mais que volume.

**IA liberada.** Use os agentes de código do seu dia a dia. Só saiba defender e
estender o que entregou — na conversa depois, a gente mexe no seu código junto.
