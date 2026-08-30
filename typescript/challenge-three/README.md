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

Ela é servida por uma **API HTTP** (`src/app.ts`, Express) — é assim que o harness
bate nela, como na Brenda real:

| Rota | O quê |
|---|---|
| `GET /` | vem pronto — responde `{ ok: true }` quando o server sobe |
| `POST /orders` | body `{ messages }` → devolve o `Result` (vem ligado ao `handleConversation`) |
| `POST /owner/notify` | **você cria** — recebe a escalação pro dono |

Não tem roteiro: **os testes são a especificação.** Faça-os passar e maximize a
precisão.

## Como rodar

```bash
npm install
npm test              # contrato determinístico (LLM controlada, in-process) — faça passar
npm start             # sobe a API (src/app.ts) em http://localhost:5052
npm run test:api      # NOUTRO terminal, com o server no ar: bate nos endpoints por HTTP
```

- `npm test` usa uma **LLM de teste** (`makeFakeLLM`) que devolve uma seleção fixa,
  então é determinístico. Cobre o que seu pipeline deve aceitar, recusar e precificar
  — incluindo o incluso-vs-extra da marmita. Não precisa de server nem de chave.
- `npm run test:api` **depende do server no ar** (`npm start`) e precisa de
  `OPENAI_API_KEY` (peça a chave, copie `.env.example` para `.env`). Bate em
  `/health`, `/owner/notify` e manda conversas reais pro `/orders` — a precisão do
  `/orders` é uma **nota** (maximize), o resto é pass/fail.

## O que a gente valoriza (seja pleno)

- **Como você torna o probabilístico confiável.** LLM erra; o pedido não pode
  sair errado. Pense onde entra código determinístico.
- **Tratar os casos que doem**, não só o happy-path: ambiguidade (pedir
  clarificação em vez de chutar), incluso vs extra, escolha obrigatória, mudança
  de ideia.
- **Cabeça de escala:** latência, custo (modelo, menos chamadas, cache) e como
  você **mediria precisão** em produção.
- **Observabilidade das chamadas de LLM.** A gente vive de debugar precisão em
  produção. Instrumente suas chamadas pra dar visibilidade do que entrou e do que
  o modelo decidiu — o suficiente pra entender *por que* um pedido saiu como saiu.
  Deixe aparecendo quando roda **e persista esse rastro num arquivo separado** (não
  só no console), pra dar pra investigar uma call depois.
- **Escalar pro dono quando não é pra resolver.** Nem tudo é pedido: o cliente
  querendo falar com uma pessoa, uma reclamação, algo fora do cardápio. Nesses
  casos a Brenda deve **acionar o dono do restaurante por uma chamada HTTP**. O
  `app.ts` já é um server Express com `/health` e `/orders` — **adicione o endpoint
  `POST /owner/notify`** que recebe a escalação, e faça o pipeline **chamá-lo** de
  verdade quando escalar. Trate a falha da chamada sem derrubar o atendimento.

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
  que você faria com mais tempo / mais volume pra mover precisão, latência, custo.

**Time-box sugerido: 3–4h.** Foco e julgamento valem mais que volume.

**IA liberada.** Use os agentes de código do seu dia a dia. Só saiba defender e
estender o que entregou — na conversa depois, a gente mexe no seu código junto.
