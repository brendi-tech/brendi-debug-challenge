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
`totalPrice`), ou uma recusa quando for inválido / ambíguo. **Como você organiza
o pipeline por dentro é decisão sua** — o que delega pra LLM, o que garante em
código, como valida e precifica. O stub está em `src/handleConversation.ts`.

Não tem roteiro: **os testes são a especificação.** Faça-os passar e maximize a
precisão.

## Como rodar

```bash
npm install
npm test              # comportamento esperado (LLM controlada) — faça passar
npm run precision     # qualidade da interpretação com a LLM real
```

- `npm test` roda com uma **LLM de teste** (`makeFakeLLM`) que devolve uma seleção
  fixa, então é determinístico. Cobre o que seu pipeline deve aceitar, recusar e
  precificar — incluindo o caso incluso-vs-extra da marmita.
- `npm run precision` usa a LLM de verdade (precisa de `OPENAI_API_KEY` — peça a
  chave ao entrevistador, copie `.env.example` para `.env`). Roda conversas reais
  e compara o `Checkout` produzido com o esperado. É uma **nota**, não pass/fail —
  o objetivo é maximizar a precisão. `-- --mock` roda sem chave só pra ver de pé.

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
  Deixe isso aparecendo quando roda.

## O que já vem pronto

`src/types.ts` (contratos), `src/menu.ts` (loader), `src/llm.ts` (wrapper da LLM +
`makeFakeLLM`), `data/menu.json` (cardápio), e o harness de `npm test` /
`npm run precision`. O resto é com você.

## Entrega

- `handleConversation` implementado, `npm test` verde.
- Um **`SOLUTION.md`** curto: decisões, tradeoffs, e uma seção **"em escala"** — o
  que você faria com mais tempo / mais volume pra mover precisão, latência, custo.

**Time-box sugerido: 3–4h.** Foco e julgamento valem mais que volume.

**IA liberada.** Use os agentes de código do seu dia a dia. Só saiba defender e
estender o que entregou — na conversa depois, a gente mexe no seu código junto.
