# SOLUTION — solução de referência

> Gabarito interno. Não faz parte do que o candidato recebe.

## Decisão central: separar probabilístico de determinístico

`handleConversation` é fino de propósito. O trabalho real está em duas camadas:

- **`src/lib/interpret.ts`** — a **única** parte que fala com a LLM. Ela só
  traduz a conversa numa **seleção estruturada** (`{ products: [{ productId,
  quantity, chosen }] }`), usando ids do cardápio. Não valida, não precifica.
- **`src/lib/priceCheckout.ts`** — **sem LLM**. Valida a seleção contra o menu
  (produto existe/ativo, escolha pertence ao produto, obrigatórios, min/max) e
  **precifica** (preço sempre do menu). É o que garante que o pedido não sai
  errado, mesmo que a LLM erre.

Por que isso importa: é o único jeito de ter **testes determinísticos** com uma
LLM não-determinística no meio. Os `behaviour.test.ts` injetam uma LLM controlada
(`makeFakeLLM`) e batem no `priceCheckout` de forma binária; a `precision` mede
só a qualidade da `interpret`.

## Escolhas pontuais

- **A LLM nunca decide preço nem inventa produto.** Ela devolve ids; se um id não
  existe no menu, `priceCheckout` recusa. É o guardrail contra "mil pizzas por R$0".
- **Ambiguidade → clarificação, não chute.** A `interpret` é instruída a devolver
  `products` vazio + `clarification` quando dois produtos batem igual.
- **Incluso vs extra** vive no `priceCheckout`: para um custom `increase` com
  `includedQuantity`, as N primeiras unidades do grupo são grátis e o excedente
  cobra `extraPrice` (marmita com 2 carnes = 1 inclusa + 1 extra).
- **Menu compacto no prompt:** mando só `productId/name/aliases + choices`, não o
  cardápio inteiro, pra cortar tokens.
- **Observabilidade da call:** um sink único (`lib/observability.ts`) manda cada
  evento pra **stderr** (visão ao vivo, sem sujar o pedido no stdout) **e** appenda
  num **arquivo JSONL separado** (`llm-calls.jsonl`, um evento por linha) pra
  investigar uma call depois. Registro tokens + latência (`llm`) e um `reasoning`
  de 1 frase do modelo (`interpret`). O `reasoning` vem primeiro no JSON, então
  funciona como um chain-of-thought curto que ainda ajuda a decisão. Falha de I/O
  do log é engolida de propósito — o rastro nunca pode derrubar o pedido.
- **Escalar pro dono (3ª saída):** a `interpret` sinaliza `escalate` quando não é
  pra Brenda resolver (quer uma pessoa, reclamação, fora do cardápio) — distinto de
  `clarification` (pergunta que o cliente responde). Aí `handleConversation` chama
  `notifyOwner`, um POST simples pro webhook do dono (estendi o servidor mock do
  template — `mock/server.ts`, `npm run mock` — com a rota `POST /owner/notify`), e
  devolve `{ ok:false, escalated:true }`. A call é
  fail-safe: se o webhook cai, a gente loga e segue — nunca derruba o atendimento.
  URL vem de `OWNER_WEBHOOK_URL` (default `localhost:4000`).

## Em escala (o que eu faria com mais tempo / volume)

- **Webhook do dono confiável:** hoje é fire-and-forget. Em produção: retry com
  backoff + fila (a notificação não pode se perder), idempotência por conversa, e
  auth no webhook (token/HMAC).

- **Medir precisão como métrica viva**, não só no dev: precisão por campo
  (produto, adicional, quantidade) em produção, não só um número agregado — pra
  saber *onde* quebra.
- **Custo/latência:** o menu inteiro no prompt não escala pra loja grande. Faria
  **retrieval** (mandar só os produtos plausíveis pra conversa) e mediria o
  trade-off precisão × tokens. Avaliaria um modelo menor pra interpretação, com
  fallback pro maior só em casos difíceis.
- **Cache semântico:** perguntas equivalentes ("que horas fecha?" ≈ "horário de
  funcionamento") não precisam reativar o modelo.
- **Eval como gate de CI:** rodar a suíte de precisão a cada mudança de prompt e
  bloquear regressão — o mesmo padrão dos nossos interaction tests.
- **Guardrails como contrato explícito** (ex.: teto de valor/itens pedindo
  confirmação), pra a superfície de erro ser conhecida e testável.

## Limitações assumidas (time-box)

- `findProduct` casa por slug/nome/alias exato; não faz fuzzy/typo. Em produção
  isso é retrieval + normalização.
- A checagem de min/max é simples (por contagem); casos de opção com `quantity`
  por escolha são cobertos, mas não exaustivamente.
- `notes` (ex.: "sem cebola") é preservado, mas não interpretado.

## Como validar

```bash
npm test           # 12/12 verde — núcleo determinístico + escalação
npm run precision  # com OPENAI_API_KEY: mede a interpretação (deve pontuar alto)
npm run mock       # sobe o servidor mock (/health + /owner/notify); escale e veja chegar
```

`npm run precision -- --mock` **não** é sinal de precisão: o mock não interpreta.
