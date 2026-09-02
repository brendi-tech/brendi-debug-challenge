# Interno — como avaliar o challenge-three (Conversational AI SWE)

> **Não mandar este arquivo pro candidato.** (Remova/ignore no que ele recebe.)
>
> **A rubrica vive AQUI de propósito, não no README.** O README só diz *o que
> construir* (tarefas + testes como spec). Se a gente listar lá "o que a gente
> valoriza" (separar determinístico, clarificar ambiguidade, cabeça de escala…), o
> candidato cola no prompt e a IA molda a solução pra bater cada ponto — fabricando
> o sinal. Não re-vaze a rubrica no README. Uma solução que acerta todos os pontos
> mas **não se sustenta no walkthrough** (não explica o *porquê*, trava ao estender)
> é AI-shaped: o ao-vivo é o filtro.

## Como rodar o processo

O take-home é **IA-trivial** → não é o filtro, é o **artefato pra interrogar**. O
sinal mora no ao-vivo.

1. **Take-home** (async, IA liberada, ~1-2h) — core: montar/clarificar + guardrails +
   precisão. Ele chega **dono de um código que entende**. Não discrimina sozinho.
2. **Auditoria** (antes da live, ~15min) — lê o código + `SOLUTION.md`, chega com 2-3
   perguntas cravadas (ver *Pré-entrevista* abaixo).
3. **Live** (~60-90min):
   - **Walkthrough** — sonda *por quê / alternativa / predição*.
   - **1 extensão** no próprio código — do *Banco de extensões*, parte com o agente desligado.
   - **System design (whiteboard)** — o macro (ver seção no fim).

| Peça | Mede |
|---|---|
| Take-home | produz o artefato |
| Auditoria + walkthrough | entende o que shippou? (anti-vibe-coder) |
| Extensão live | a estrutura dele aguenta? (anti-ghostwriter) |
| System design | pensa concorrência/escala? (à prova de IA) |

**Regras de ouro:** não telegrafe o split (os testes forçam sem dizer) · piso ≠ alvo
(o sinal é o **grau** + as dores específicas) · gradua a **jornada e o raciocínio**,
não a conclusão · IA é o job — teste se ele **entende e é dono**.

## Distribuição pro candidato (zip)

O candidato recebe um **zip gerado por `git archive`** da branch do desafio — **NÃO**
um clone (clone carrega branches + histórico + a `solution/*`). Da raiz do repo:

```bash
git archive --format=zip -o challenge-three.zip \
  feat/challenge-three-conversational:typescript/challenge-three
```

Por que é seguro:

- `git archive` exporta **só arquivos trackeados** no commit → `.env` (a chave real),
  `node_modules/` e `llm-calls.jsonl` (gitignored) **não entram**.
- O `.gitattributes` marca `INTERVIEWER.md`, `SOLUTION.md` e ele mesmo como
  `export-ignore` → **não entram** no zip (o candidato nem descobre que existe rubrica).
- Só o subtree `typescript/challenge-three` (não o monorepo inteiro) e só a branch do
  desafio — a `solution/*` nem é tocada.

**Sempre gere da branch do desafio (`feat/challenge-three-conversational`), nunca da
`solution/*`.** Confira antes de mandar:

```bash
unzip -l challenge-three.zip | grep -E "INTERVIEWER|SOLUTION" && echo "VAZOU — NÃO mande" || echo "limpo"
```

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
| **Escalação (webdev)** | detecta quando não é pra resolver, adiciona `POST /owner/notify` no `app.ts` e o pipeline chama de verdade; trata falha da call | não trata; "escala" sem chamada real ou sem endpoint; call quebra derruba o atendimento |
| **Domínio (casos que doem)** | acerta incluso-vs-extra, obrigatórios, mudança de ideia | só happy-path |
| **Cabeça de escala** | fala de latência/custo/modelo/cache + como medir precisão | não menciona |
| **Código + julgamento** | limpo, tipado, `SOLUTION.md` com tradeoffs e "em escala" | decisões não-explicadas |

O `SOLUTION.md` (a seção "em escala") é onde o pleno aparece. Repare também em
**como ele estruturou o `src/`** — isso é escolha dele, não nossa.

## Casos plantados (o que cada um testa)

- **incluso vs extra (marmita):** o separador. Cobrar 1 carne extra, não virar 2
  marmitas (custom `carne-marmita`, `includedQuantity: 1`).
- **ambiguidade ("me vê um hambúrguer"):** 3 lanches batem igual → pedir
  clarificação, não chutar. Guardrail contra "mil pizzas por R$0".
- **histórico antigo (sessão passada):** o pedido certo é o atual, não o já entregue.
- **obrigatório + 2 produtos, mudança de ideia, adicionais:** realidade da conversa.

## Pré-entrevista: auditar a entrega (chegue com as perguntas prontas)

O take-home é async e **IA liberada** — então o artefato, por si, é **~zero sinal**
(uma IA resolve o core inteiro; ver dogfood). O valor está em **auditar antes** e
chegar na live com **perguntas cravadas no código DELE**, não genéricas. A auditoria
é o que transforma o artefato na munição da entrevista.

**Rode este checklist na entrega (15 min lendo o código + `SOLUTION.md`):**

- Achou a **separação LLM×determinístico**? Onde? (interpret só *propõe* ids; o código
  *valida e precifica*.) É o sinal central.
- **Preço sempre do menu?** Guardrails presentes (produto inexistente/inativo,
  obrigatórios, min/max, incluso-vs-extra)?
- **🚩 Red flags:** regra de negócio no prompt; confia em preço/produto vindo da LLM;
  tudo numa função só; guardrails ausentes; ambiguidade vira chute.
- **`SOLUTION.md` "em escala":** tem tradeoff real (retrieval, medir precisão, custo)
  ou é genérico/decorado?
- **🚩 Tell de AI-slop:** abstração sofisticada demais pro nível declarado, código
  morto, comentário que não bate com o código, estilo inconsistente (copiou sem
  entender).

**Transforme os achados em 2–3 perguntas marcadas (leve prontas):**

- Aponte uma **decisão/linha específica** → *"por que assim, e não X?"*
- Ache um **edge que os testes NÃO cobrem** e veja se o código dele trata → *"o que
  acontece se…?"*
- **Sophistication-gap:** se o código é mais sofisticado do que o walkthrough dele
  consegue explicar, é o **tell mais forte** de "a IA fez, ele não entende". Cave aí.
- **Já escolha qual extensão** dar na live (do banco abaixo), baseado em onde a
  estrutura dele é fraca/forte — e qual parte pedir com o **agente desligado**.

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
  Adapta a call e trata o erro."* (mexe no `/owner/notify` do `app.ts` + na chamada HTTP — webdev)
- *"Esse cliente é antigo: o histórico tem 3.000 mensagens e estoura a janela do
  modelo. Faz o pipeline aguentar."* (janela de contexto — espera windowing/recência/
  resumo, não mandar a conversa inteira no prompt. Pergunte como ele decidiria o que
  cortar sem perder o pedido atual.)

**Por que estender o próprio código:** prova que a entrega é dele (se AI-gerou
tudo, trava no próprio repo), testa o design de base, execução ao vivo e domínio.
Se o `src/` está bem estruturado, a extensão encaixa limpa; se é monólito, ele
remenda — e isso é sinal.

## IA no live: como ele usa

Liberada — é o job. **Não conta *se* usa nem *quanto*; conta se o entendimento e a
autoria são dele.** A distinção-mãe: ele **dirige** a IA (segura o design e a régua de
correção, usa como mão rápida) ou **delega** (terceiriza o pensamento e só repassa)?
Tudo abaixo é sintoma disso — observe enquanto ele estende o próprio código:

- **Lê e verifica o output** *(o sinal nº 1).* 🟢 lê / roda / questiona antes de
  aceitar. 🔴 cola-e-reza.
- **Pega os erros da IA.** 🟢 percebe alucinação / over-engineer e **empurra de volta**
  ("não, isso quebra porque…"). 🔴 só nota quando o teste falha. *(Só pega o erro da IA
  quem entende o problema — o tell mais afiado.)*
- **Dirige vs despeja.** 🟢 decompõe e direciona em pedaços que já raciocinou; **ele**
  segura a arquitetura. 🔴 cola a tarefa inteira e deixa a IA arquitetar.
- **Recupera quando a IA trava.** 🟢 assume o volante (lê, raciocina, conserta na mão).
  🔴 re-prompta "não funciona" em loop esperando a IA se salvar.
- **Sabe quando NÃO usar IA.** 🟢 mudança pequena/clara, só digita. 🔴 pede pra IA até o
  trivial — dependência reflexa.
- **Qualidade do prompt.** 🟢 dá contexto + restrições + a forma que quer. 🔴 joga o erro
  cru e torce.
- **Integra vs empilha.** 🟢 adapta o output ao estilo/estrutura dele. 🔴 cola como veio
  (AI-slop: estilo inconsistente, código morto, abstração demais).
- **Explica sem o agente.** Peça pra explicar/mexer numa parte com o agente desligado.
  🟢 defende cada linha. 🔴 "a IA que fez, funciona" e trava quando você aponta.

Calibração: um sênior pode usar IA o tempo todo e continuar sendo claramente o **dono**;
um fraco usa igual e a **IA é a dona**.

## Banco de extensões (ao-vivo)

Estas dimensões **saíram do take-home de propósito** — o dogfood mostrou que a IA
resolve todas trivialmente, então no take-home elas só inflam o box sem discriminar.
Aqui elas viram **extensões ao-vivo do próprio código do candidato**, que é onde o
filtro anti-vibe-coder morde. Escolha 1–2 conforme o candidato/vaga, não crave todas.
Formato: **abre** (verbal) → **mão** (faz no próprio código) → **gotcha** (separa
raso de bom).

**🏠 Endereço**
- Abre: *"Agora o cliente precisa dizer onde entregar. Como você encaixaria endereço no que já tem?"*
- Mão: *"Ele tem endereços salvos (`casa`, `trabalho`) e diz 'manda pra casa'. Como vira o endereço do pedido? Bora codar."*
- Gotcha: *"E se ele ditar um endereço novo no chat? E se falar 'manda pra casa' sem ter 'casa' salvo?"*
- 🟢 LLM só identifica QUAL apelido; o código copia o texto salvo. 🔴 deixa a LLM inventar o endereço.

**💳 Pagamento**
- Abre: *"Como você trataria forma de pagamento — pix, dinheiro, cartão?"*
- Mão: *"O cliente diz 'dinheiro, troco pra 50'. Modela isso no checkout."*
- Gotcha: *"A loja só aceita pix e dinheiro, e ele pede débito — o que seu código faz? E se o troco for menor que o total?"*
- 🟢 LLM extrai, código valida (método aceito, troco ≥ total) — igual ao preço. 🔴 confia no que a LLM mandou / inventa "pague online".

**🔁 Reaproveitar último pedido**
- Abre: *"Cliente recorrente manda 'quero o de sempre'. Como você resolveria?"*
- Mão: *"Assume que você recebe o último pedido dele no input. Reconstrói o checkout a partir dele."*
- Gotcha: *"E se não tiver último pedido? E se for 'o de sempre, mas sem cebola' — repetição + edição junto?"*
- 🟢 copia o lastOrder em código; LLM só sinaliza a intenção. 🔴 LLM remontando o pedido de memória.

**🔭 Observabilidade**
- Abre: *"Você shippou, e amanhã um pedido sai errado em produção. Como você descobre o porquê?"*
- Mão: *"Bora instrumentar uma chamada de LLM — o que você logaria?"*
- Gotcha: *"Como você mediria PRECISÃO em produção, não só num teste? E em escala, o volume de log não vira problema?"*
- 🟢 loga entrada + decisão do modelo + tokens/latência, persiste, pensa em precisão-por-campo. 🔴 `console.log` e para aí.

**📞 Escalação + webhook do dono**
- Abre: *"Nem tudo é pedido — o cliente quer falar com uma pessoa, ou reclama. Como a Brenda lida?"*
- Mão: *"Faz ela avisar o dono por HTTP quando escalar: sobe um endpoint que recebe, e faz a chamada."*
- Gotcha: *"E se o webhook do dono cair? E se você notificar duas vezes pra mesma conversa?"*
- 🟢 escalar ≠ clarificar; call fail-safe (não derruba o atendimento); idempotência/retry. 🔴 a call quebrada derruba o pedido.

**🪟 Janela de contexto**
- Abre: *"Esse cliente é dos antigos — a conversa tem milhares de mensagens. O que acontece com seu prompt?"*
- Mão: *"Faz o pipeline aguentar isso."*
- Gotcha: *"Como você decide o que cortar sem perder o pedido atual? Cortar basta, ou você resumiria?"*
- 🟢 windowing por recência / resumo do histórico velho; entende que é ruído. 🔴 manda a conversa inteira e estoura.

## System design (whiteboard)

Apartado do coding. É o **macro** (o pipeline inteiro), e ao vivo é **à prova de IA**.
Pergunta aberta: *"como você modelaria o sistema onde um cliente conversa no WhatsApp
e um agente responde?"* Deixa desenhar o happy-path e **fura com cenários**.

**Como rodar:** whiteboard baixa-fricção (Excalidraw, link pré-criado só com "cliente"
e "loja" nas pontas). É andaime de raciocínio, não entregável — gradua o *porquê*, não
o desenho.

**Baseline (piso — competente, não impressiona):**
- Happy-path: provider → webhook → grava a conversa (banco) → processa com a LLM →
  envia a resposta.
- Cita banco de conversas/mensagens, uma fila entre ingestão e processamento, endpoints
  (entrada/saída), config/menu por loja.
- Entende que o webhook é assíncrono do processamento.

**Bom preparo (o que separa — chega nisto sozinho):**
- **Fronteira sync/async explícita:** o webhook dá ACK rápido (timeout do provider) e
  enfileira; a LLM processa async. Sabe *por quê* (LLM lenta vs timeout).
- **Ordenação/serialização por conversa:** mensagens da mesma conversa não podem correr
  — partição/lock por `conversationId`. Fora-de-ordem e concorrência quebram o estado.
- **Idempotência + dedup:** webhook re-entregue não processa/responde 2×.
- **Debounce/batching:** junta mensagens rápidas do mesmo cliente antes de chamar a LLM.
- **Estado/janela em escala:** como guarda histórico grande e o que alimenta a LLM
  (recência/resumo) — é o context-window do coding, agora em nível de sistema.
- **Human-in-the-loop / coexistência:** um humano assume, o agente cala.
- **Falha + custo:** LLM/provider caem (retry, DLQ, replay); nº de calls por mensagem, cache.
- **Multi-tenant:** isolamento + prompt/menu/config por loja.

**Cenários pra furar** (aponte no desenho): 2 mensagens ao mesmo tempo na mesma conversa
· o provider re-entregou o webhook · a LLM levou 8s e o cliente mandou +2 · um humano
quer assumir · 10 mil lojas.

- 🟢 chega em **ordenação/concorrência + sync-async + idempotência sem você apontar**,
  raciocina tradeoff, marca a fronteira e os pontos de falha.
- 🔴 fica no "DB + fila + API", trata a LLM como síncrona, trava quando você injeta um cenário.
