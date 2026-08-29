# Interno — como avaliar o challenge-three (pleno)

> **Não mandar este arquivo pro candidato.** (Idealmente remova/ignore no que o
> candidato recebe.)

Este desafio testa o que define **pleno** pra gente: desenhar um pipeline LLM
**confiável e testável** e pensar em **precisão / latência / custo em escala** —
não só "sabe codar".

## O sinal central (a tensão de propósito)

TDD + LLM se contradizem: LLM é não-determinística, teste de igualdade fica
flaky. **Quem é pleno resolve isso separando as camadas** — força saída
estruturada da LLM, e põe a lógica que precisa de garantia no núcleo
determinístico (testável). Quem não sacou vai tentar assertar em cima da saída
da LLM (frágil) ou jogar a regra de negócio dentro do prompt.

- 🟢 Estrutura a interpretação (JSON), valida/precifica no determinístico, escreve
  o `assembleOrder` limpo, deixa `npm test` verde.
- 🔴 Regra de negócio no prompt; preço vindo da LLM; testes frágeis; guardrails
  ausentes (aceita item fora do menu / indisponível / preço absurdo).

## Rubrica (mapeada na régua de pleno)

| Dimensão | 🟢 forte | 🔴 fraco |
|---|---|---|
| **Confiabilidade / testabilidade** | camadas separadas, `npm test` verde, guardrails sólidos | regra no prompt, testes flaky, sem guardrail |
| **LLM engineering** | structured output, sinaliza ambiguidade, trata falha | chuta no ambíguo, alucina produto/preço |
| **Domínio (casos que doem)** | acerta incluso-vs-extra, combo, mudança de ideia | só happy-path |
| **Cabeça de escala** | fala de latência/custo/modelo/cache + como medir precisão | não menciona |
| **Código + julgamento** | limpo, tipado, `SOLUTION.md` com tradeoffs e "em escala" | sem contexto, decisões não-explicadas |

O `SOLUTION.md` (principalmente a seção "em escala") é onde o pleno aparece. Um
júnior implementa; um pleno implementa **e** raciocina sobre escalar.

## Casos plantados (o que cada um testa)

- **incluso vs extra (marmita):** o separador. 1 marmita + 1 carne extra, não 2
  marmitas. Se ele acerta isso no determinístico, é ótimo sinal.
- **ambiguidade ("hambúrguer com bacon"):** deve pedir clarificação, **não**
  alucinar. Guardrail contra o "mil pizzas por zero reais".
- **combo, mudança de ideia, adicionais+remoção:** realidade da conversa.

## Live coding = estender o PRÓPRIO take-home (não função solta)

Junta o walkthrough com o live coding numa sessão. Ele apresenta (5–10 min),
você entende o design, e aí **dropa um requisito novo, sem avisar antes**:

- *"Agora a loja tem combo. O cliente pede 'combo x-salada'. Faz encaixar."*
  (o menu já tem `combo-x-salada` dormente e `isCombo`)
- *"Adiciona um guardrail: pedido acima de R$500 ou 20 itens precisa de
  confirmação."* (onde ele pôs o determinismo)
- *"Chegou um follow-up: 'na verdade tira a cebola'. Trata a edição."* (estado da
  conversa)
- *"O Milkshake ficou indisponível. Como você garante que a Brenda não oferece?"*
  (o `available: false` já está lá)
- *"Roda o eval com mais um caso ambíguo que eu te dou agora."*

**Por que estender o próprio código:** prova que a entrega é dele (se AI-gerou
tudo, trava no próprio repo), testa design de base (encaixa limpo ou remenda?),
execução ao vivo e domínio — tudo de uma vez.

**IA no live:** liberada (é o job). Observe **como** ele usa — dirige com
julgamento e revisa, ou cola cego? Se quiser sinal cru de fundamento, peça pra
ele explicar uma parte **sem** o agente.

## O que observar no live

- Extendeu **limpo** ou **remendou**? (qualidade do design de base)
- Raciocinou o tradeoff **antes** de codar?
- Achou o lugar certo no **próprio** código rápido (= é dele)?
- Pensou em **não quebrar o que já passava** (mentalidade de escala)?
