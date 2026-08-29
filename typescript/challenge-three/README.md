# Desafio Técnico — Brenda: montar o pedido a partir da conversa (TypeScript)

> Nível **pleno**. Take-home assíncrono. Depois marcamos uma conversa curta pra
> você apresentar e a gente estender junto.

## Contexto

Na Brendi, a **Brenda** é a IA que atende no WhatsApp e monta o pedido do cliente
(produtos, adicionais, entrega, pagamento) pra milhares de restaurantes. O
coração disso é pegar uma conversa em linguagem natural, cruzar com o cardápio da
loja e produzir um **pedido correto** — de forma **confiável**, apesar de a LLM
ser probabilística.

Este desafio é uma versão mínima e honesta desse problema.

## A missão

Dado o **cardápio** de uma loja (`data/menu.json`) e uma **conversa**, seu
pipeline deve produzir um pedido válido e precificado — ou pedir clarificação
quando for ambíguo demais pra chutar.

O código está estruturado em **duas camadas** de propósito:

1. **Núcleo determinístico** (`src/guardrails.ts`) — valida e precifica o pedido.
   Sem LLM. É aqui que mora a confiabilidade, e é o que os **testes** cobrem.
2. **Interpretação** (`src/orderAssembler.ts`) — a única parte que fala com a
   LLM. Lê a conversa e produz um rascunho estruturado do pedido.

Os stubs estão marcados com `TODO`. **Implemente-os.**

## Como rodar

```bash
npm install
npm test          # os testes deterministicos — faça todos passarem (TDD)
npm run eval      # mede a precisão da sua interpretação nos casos reais
```

- `npm test` **não usa LLM** e deve ficar 100% verde. É o seu contrato de
  confiabilidade.
- `npm run eval` usa a LLM de verdade (precisa de `OPENAI_API_KEY` — peça a chave
  ao entrevistador e copie `.env.example` para `.env`). É uma **nota**, não um
  pass/fail: o objetivo é **maximizar a precisão** nos casos, não cravar 100% num
  único run. Rode com `-- --mock` só pra ver o harness de pé sem chave.

## O que a gente valoriza (seja pleno)

- **Como você torna o probabilístico confiável** — saída estruturada, validação
  determinística, não confiar em preço/produto vindo da LLM.
- **Tratar os casos que doem**, não só o happy-path: ambiguidade, adicionais,
  **incluso vs extra** (a marmita), mudança de ideia, combo.
- **Cabeça de escala:** latência, custo (escolha de modelo, menos chamadas,
  cache) e como você **mediria precisão** em produção.

## Entrega

- O código com os `TODO` implementados e `npm test` verde.
- Um **`SOLUTION.md`** curto: decisões que você tomou, tradeoffs, e uma seção
  **"em escala"** — o que você faria com mais tempo / com mais volume / pra mover
  precisão, latência e custo.

**Time-box sugerido: 3–4h.** Não gaste mais que isso — a gente valoriza foco e
julgamento sobre volume. Se cortar escopo, diga no `SOLUTION.md` o que cortou e
por quê.

**IA liberada.** Use os agentes de código que você usa no dia a dia — faz parte
de como a gente trabalha. Só saiba defender e estender o que entregou: na
conversa depois, a gente vai mexer no seu código junto.
