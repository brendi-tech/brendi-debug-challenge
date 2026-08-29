# Interno — como avaliar o challenge-three (pleno)

> **Não mandar este arquivo pro candidato.** (Remova/ignore no que ele recebe.)

Testa o que define **pleno** pra gente: desenhar um pipeline LLM **confiável e
testável** e pensar em **precisão / latência / custo em escala** — não só "sabe
codar". Os tipos e o formato espelham o código real (Menu de listas planas,
`ProductCustom` união por type, `Checkout`, `compareCheckout` esparso).

## O sinal central (a tensão de propósito)

TDD + LLM se contradizem: LLM é não-determinística, assert de igualdade fica
flaky. **Quem é pleno resolve separando as camadas** — a LLM (`selectProducts`)
devolve uma **seleção estruturada**, e a lógica que precisa de garantia mora no
`priceCheckout` (determinístico, testável).

- 🟢 `selectProducts` produz um `Checkout` estruturado; `priceCheckout` valida e
  precifica; `npm test` verde; preço sempre do menu.
- 🔴 Regra de negócio dentro do prompt; preço vindo da LLM; testes frágeis;
  guardrails ausentes (aceita produto fora do menu / inativo / escolha inválida).

## Rubrica (mapeada na régua de pleno)

| Dimensão | 🟢 forte | 🔴 fraco |
|---|---|---|
| **Confiabilidade / testabilidade** | camadas separadas, `npm test` verde, guardrails sólidos | regra no prompt, testes flaky, sem guardrail |
| **LLM engineering** | saída estruturada, sinaliza ambiguidade, trata falha | chuta no ambíguo, alucina produto/preço |
| **Domínio (casos que doem)** | acerta incluso-vs-extra (marmita), obrigatórios, mudança de ideia | só happy-path |
| **Cabeça de escala** | fala de latência/custo/modelo/cache + como medir precisão | não menciona |
| **Código + julgamento** | limpo, tipado, `SOLUTION.md` com tradeoffs e "em escala" | decisões não-explicadas |

O `SOLUTION.md` (a seção "em escala") é onde o pleno aparece. Júnior implementa;
pleno implementa **e** raciocina sobre escalar.

## Casos plantados (o que cada um testa)

- **incluso vs extra (marmita):** o separador. `priceCheckout` deve cobrar 1
  carne extra, não virar 2 marmitas (custom `carne-marmita`, `includedQuantity: 1`).
- **ambiguidade ("hambúrguer com bacon"):** deve pedir clarificação, **não**
  alucinar (X-Bacon vs X-Salada+bacon). Guardrail contra "mil pizzas por R$0".
- **obrigatório + 2 produtos, mudança de ideia, adicionais:** realidade da conversa.

## Live coding = estender o PRÓPRIO take-home (não função solta)

Junta o walkthrough com o live numa sessão. Ele apresenta (5–10 min), você
entende o design, e aí **dropa um requisito novo, sem avisar**:

- *"O cliente pede 'combo x-salada'. Faz o selectProducts casar o produto combo."*
  (`combo-x-salada` já existe no menu)
- *"Milkshake ficou indisponível — garante que a Brenda não oferece."* (o produto
  já está `active: false`; onde ele checa isso?)
- *"Adiciona um guardrail: pedido acima de R$500 ou 20 itens precisa de confirmação."*
- *"Chegou um follow-up: 'na verdade tira a cebola'. Trata a edição."* (estado da conversa)
- *"O adicional 'bacon' passou a ter limite de 2 por lanche. Faz valer."* (mexe no
  `check` maxChoices no `priceCheckout`)

**Por que estender o próprio código:** prova que a entrega é dele (se AI-gerou
tudo, trava no próprio repo), testa design de base, execução ao vivo e domínio.

**IA no live:** liberada (é o job). Observe **como** ele usa — dirige com
julgamento e revisa, ou cola cego? Pra sinal cru de fundamento, peça pra ele
explicar uma parte **sem** o agente.

## O que observar no live

- Extendeu **limpo** (bom design de base) ou **remendou**?
- Raciocinou o tradeoff **antes** de codar?
- Achou o lugar certo no **próprio** código rápido (= é dele)?
- Pensou em **não quebrar o que já passava** (mentalidade de escala)?
