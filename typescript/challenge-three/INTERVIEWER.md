# Interno — como avaliar o challenge-three (pleno)

> **Não mandar este arquivo pro candidato.** (Remova/ignore no que ele recebe.)

Testa o que define **pleno** pra gente: desenhar um pipeline LLM **confiável e
testável** e pensar em **precisão / latência / custo em escala** — não só "sabe
codar". De propósito, o desafio é **aberto**: uma função (`handleConversation`),
os contratos (tipos) e os testes como spec. A **estrutura é dele** — e é aí que o
pleno aparece.

## O sinal central (o que ele tem que descobrir sozinho)

TDD + LLM se contradizem: LLM é não-determinística. **Quem é pleno chega sozinho**
na separação: a LLM só interpreta (produz uma seleção estruturada) e a lógica que
precisa de garantia (validar produto/escolha, preço, incluso-vs-extra) fica em
código determinístico. Ninguém disse isso pra ele no enunciado.

- 🟢 Separou interpretação de validação/precificação; preço sempre do menu; `npm
  test` verde; código organizado sem a gente ter mandado.
- 🔴 Jogou regra de negócio no prompt; confiou em preço/produto vindo da LLM;
  tudo numa função só e frágil; guardrails ausentes.

## Rubrica (mapeada na régua de pleno)

| Dimensão | 🟢 forte | 🔴 fraco |
|---|---|---|
| **Arquitetura / testabilidade** | achou a separação sozinho; determinístico isolado e testável | monólito frágil; regra no prompt |
| **LLM engineering** | saída estruturada, sinaliza ambiguidade, trata falha | chuta no ambíguo, alucina produto/preço |
| **Observabilidade** | instrumenta a call (tokens/latência + o que o modelo decidiu) e persiste num arquivo; dá pra investigar uma call depois | chamada é caixa-preta; nada persistido; não dá pra ver por que errou |
| **Escalação (webdev)** | detecta quando não é pra resolver, escala pro dono via HTTP, sobe o mock e a call funciona de verdade; trata falha da call | não trata; "escala" sem chamada real ou sem endpoint; call quebra derruba o atendimento |
| **Domínio (casos que doem)** | acerta incluso-vs-extra, obrigatórios, mudança de ideia | só happy-path |
| **Cabeça de escala** | fala de latência/custo/modelo/cache + como medir precisão | não menciona |
| **Código + julgamento** | limpo, tipado, `SOLUTION.md` com tradeoffs e "em escala" | decisões não-explicadas |

O `SOLUTION.md` (a seção "em escala") é onde o pleno aparece. Repare também em
**como ele estruturou o `src/`** — isso é escolha dele, não nossa.

## Casos plantados (o que cada um testa)

- **incluso vs extra (marmita):** o separador. Cobrar 1 carne extra, não virar 2
  marmitas (custom `carne-marmita`, `includedQuantity: 1`).
- **ambiguidade ("hambúrguer com bacon"):** pedir clarificação, não alucinar
  (X-Bacon vs X-Salada+bacon). Guardrail contra "mil pizzas por R$0".
- **obrigatório + 2 produtos, mudança de ideia, adicionais:** realidade da conversa.

## Live coding = estender o PRÓPRIO take-home

Junta o walkthrough com o live numa sessão. Ele apresenta (5–10 min), você entende
o design, e aí **dropa um requisito novo, sem avisar**:

- *"O cliente pede 'combo x-salada'. Faz casar o produto combo."* (`combo-x-salada`
  já existe no menu)
- *"Milkshake ficou indisponível — garante que a Brenda não oferece."* (já está
  `active: false`; onde ele checa?)
- *"Pedido acima de R$500 ou 20 itens precisa de confirmação — adiciona o guardrail."*
- *"Chegou um follow-up: 'na verdade tira a cebola'. Trata a edição."* (estado da conversa)
- *"O adicional 'bacon' passou a ter limite de 2 por lanche."* (mexe no `check`)
- *"O webhook do dono agora exige um header `X-Store-Token` e responde 401 sem ele.
  Adapta a call e trata o erro."* (mexe no endpoint mock + na chamada HTTP — webdev)

**Por que estender o próprio código:** prova que a entrega é dele (se AI-gerou
tudo, trava no próprio repo), testa o design de base, execução ao vivo e domínio.
Se o `src/` está bem estruturado, a extensão encaixa limpa; se é monólito, ele
remenda — e isso é sinal.

**IA no live:** liberada (é o job). Observe **como** ele usa. Pra sinal cru de
fundamento, peça pra explicar uma parte **sem** o agente.
