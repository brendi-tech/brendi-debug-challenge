# Desafio Técnico — Brenda: montar o pedido a partir da conversa (TypeScript)

> Nível **pleno**. Take-home assíncrono. Depois marcamos uma conversa curta pra
> você apresentar e a gente estender junto.

## Contexto

Na Brendi, a **Brenda** é a IA que atende no WhatsApp e monta o pedido do cliente
pra milhares de restaurantes. O coração disso é pegar uma conversa em linguagem
natural, cruzar com o cardápio da loja e produzir um **pedido correto** — de
forma **confiável**, apesar de a LLM ser probabilística.

Este desafio é uma versão mínima e honesta desse problema. Os tipos e o formato
espelham o nosso código real: um `Menu` de listas planas (`products` /
`customs`), um `Checkout` como pedido montado, e testes de precisão que comparam
o `Checkout` produzido com um `expectedCheckout`.

## A missão

O pipeline tem **duas camadas** de propósito — e a divisão é justamente o
desafio:

1. **`selectProducts`** (`src/selectProducts.ts`) — a **única** parte que fala com
   a LLM. Lê a conversa + o menu e produz uma **seleção** estruturada (um
   `Checkout` sem preço). Probabilístico.
2. **`priceCheckout`** (`src/priceCheckout.ts`) — **determinístico**, sem LLM.
   Valida a seleção contra o menu (produto existe/ativo, escolha pertence ao
   produto, obrigatórios, min/max) e **precifica** (preço sempre do menu). É aqui
   que mora a confiabilidade.

Os stubs estão marcados com `TODO`. **Implemente os dois.**

## Como rodar

```bash
npm install
npm test              # testes deterministicos do priceCheckout — faça passar (TDD)
npm run precision     # mede a precisão do selectProducts nos casos reais
```

- `npm test` **não usa LLM** e deve ficar 100% verde. É seu contrato de
  confiabilidade (guardrails + precificação, incluindo o caso incluso-vs-extra da
  marmita).
- `npm run precision` roda a LLM de verdade (precisa de `OPENAI_API_KEY` — peça a
  chave ao entrevistador e copie `.env.example` para `.env`). Compara o
  `Checkout` produzido com o `expectedCheckout` de cada caso via
  `compareCheckout` (asserção **esparsa**: só checa os campos presentes no
  esperado). É uma **nota**, não pass/fail — maximize a precisão. Use `-- --mock`
  só pra ver o harness de pé sem chave.

## Estrutura

```
src/
  types.ts             contratos: Menu/Product/ProductCustom, Checkout
  menu.ts              loader do cardapio (fornecido)
  llm.ts               wrapper de LLM: real + mock offline (fornecido)
  selectProducts.ts    LLM: conversa -> Checkout (TODO)
  priceCheckout.ts     deterministico: valida + precifica (TODO)
  compareCheckout.ts   comparador esparso de precisao (fornecido)
  handleConversation.ts orquestrador (fornecido)
data/menu.json         cardapio da loja de teste
__tests__/
  priceCheckout.ut.test.ts   testes deterministicos (o alvo do TDD)
  precision/                 casos (conversa -> expectedCheckout) + runner
```

## O que a gente valoriza (seja pleno)

- **Como você torna o probabilístico confiável** — LLM devolve seleção
  estruturada; validação e preço ficam no determinístico; nada de confiar em
  produto/preço vindo da LLM.
- **Tratar os casos que doem**, não só o happy-path: ambiguidade (pedir
  clarificação em vez de chutar), **incluso vs extra** (marmita), mudança de
  ideia, escolha obrigatória.
- **Cabeça de escala:** latência, custo (modelo, menos chamadas, cache) e como
  você **mediria precisão** em produção.

## Entrega

- Os `TODO` implementados, `npm test` verde.
- Um **`SOLUTION.md`** curto: decisões, tradeoffs, e uma seção **"em escala"** — o
  que você faria com mais tempo / mais volume pra mover precisão, latência, custo.

**Time-box sugerido: 3–4h.** Foco e julgamento valem mais que volume; se cortar
escopo, diga no `SOLUTION.md` o que e por quê.

**IA liberada.** Use os agentes de código do seu dia a dia. Só saiba defender e
estender o que entregou: na conversa depois, a gente mexe no seu código junto.
