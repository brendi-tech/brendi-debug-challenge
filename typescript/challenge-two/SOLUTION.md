# SOLUTION — guia do avaliador

> **Remova este arquivo antes de enviar o desafio ao candidato.**

## Resumo

O bug e uma race condition no credito de saldo. O handler do webhook faz
**read-modify-write** no saldo (`SELECT balance` -> soma em memoria ->
`UPDATE balance = <valor calculado>`) e usa uma checagem de duplicidade do tipo
**check-then-act**. Quando o PSP reentrega o mesmo evento e as duas entregas se
sobrepoem, as duas passam pela checagem e as duas creditam.

A tabela `payments` **nao** tem restricao de unicidade, e o `INSERT` usa
`ON CONFLICT DO NOTHING` sem alvo — que, sem constraint, nunca dispara. Entao as
duas entregas concorrentes **gravam duas linhas** para o mesmo pagamento *e* o
saldo e creditado duas vezes. O sintoma e "saldo maior que a soma real dos
pagamentos", e a tabela `payments` tambem fica com o mesmo pagamento repetido.

A conciliacao deduplica por `payment_id` (`DISTINCT ON`), entao o total esperado
reflete os pagamentos **reais**, nao o numero de linhas. E por isso que ela ainda
acusa divergencia: o saldo dobrou, mas o pagamento real e um so. (Se ela somasse
todas as linhas, as duas linhas duplicadas bateriam com o saldo dobrado e o bug
ficaria escondido.)

A janela do `load-webhooks` manda 128 pagamentos confirmados (4 levas x 32
restaurantes), entao o saldo de cada restaurante e a soma de 4 pagamentos e o
desvio de um deles fica diluido no total. Nao da para achar o problema
"de olho" no saldo: so a conciliacao mostra.

## Dois bugs em sequencia

O desafio tem, na pratica, **dois defeitos encadeados** — e o segundo so fica
obvio depois de corrigir o primeiro. Medido nesta maquina (Docker Desktop no
macOS, `PG_POOL_MAX=8`):

| Estado | Linhas duplicadas em `payments` | Divergencia de saldo (`RETRY_GAP=2`) |
|--------|--------------------------------|--------------------------------------|
| Como entregue (sem constraint) | **sim** | 8 em 20 (~40%) |
| Depois de adicionar a constraint (codigo ainda com bug) | nao | **12 em 12 (100%)** |
| Constraint + correcao de codigo | nao | 0 em 20 |

**Bug 1 — o extrato nao bate.** Sem `UNIQUE (payment_id, status)`, o
`ON CONFLICT DO NOTHING` nunca dispara e a reentrega concorrente grava uma
segunda linha para o mesmo pagamento. A tabela `payments` fica com o pagamento
repetido. Correcao: **adicionar a constraint** — isso limpa o extrato.

**Bug 2 — o saldo dobra (o do ticket).** O credito e check-then-act +
read-modify-write, entao a reentrega credita duas vezes. Adicionar a constraint
**nao corrige isso** — e, contra-intuitivamente, deixa o bug do saldo *mais*
frequente: o indice unico faz as duas entregas serializarem no `INSERT`, forcando
a segunda a ler o saldo ja creditado (por isso a divergencia salta de ~40% para
100% com `RETRY_GAP=2`). Correcao: gatear o credito pelo `rowCount` do `INSERT`
mais `UPDATE ... balance = balance + $1`.

A conciliacao usa `DISTINCT ON (payment_id)`, entao mede o saldo contra os
pagamentos **reais**, nao contra o numero de linhas. E o que garante que ela
acusa o Bug 2 mesmo depois que o Bug 1 sumir — e, antes disso, que ela nao seja
enganada pelas linhas duplicadas do Bug 1.

Um candidato pode entrar por qualquer lado: alguns notam a linha duplicada
primeiro (Bug 1) e so depois percebem que o saldo continua errado; outros vao
direto ao saldo. O sinal forte e perceber que **sao dois** — e que a constraint
sozinha troca um sintoma pelo outro.

## O codigo com o bug

`src/payments/payment-service.ts`, funcao `applyPaymentEvent` (linhas de log
omitidas aqui para deixar o fluxo visivel):

```ts
// 1. check-then-act: sob concorrencia, as duas entregas leem "nao existe"
const alreadyProcessed = await client.query(
  "SELECT id FROM payments WHERE payment_id = $1 AND status = $2",
  [event.payment_id, event.status]
);
if ((alreadyProcessed.rowCount ?? 0) > 0) return { outcome: "duplicate" };

// 2. sem UNIQUE na tabela, o ON CONFLICT DO NOTHING nunca dispara: as duas inserem
await client.query(
  `INSERT INTO payments (...) VALUES (...) ON CONFLICT DO NOTHING`, ...
);

// 3. read-modify-write sem lock: as duas leem o mesmo saldo
const current = await client.query(
  "SELECT balance FROM balances WHERE restaurant_id = $1", ...
);
const newBalance = toMoney(Number(current.rows[0].balance) + event.amount);
await client.query(
  "UPDATE balances SET balance = $1, updated_at = now() WHERE restaurant_id = $2",
  [newBalance, event.restaurant_id]
);
```

Sao dois defeitos independentes, e **os dois precisam ser corrigidos**:

| # | Defeito | Consequencia |
|---|---------|--------------|
| 1 | Idempotencia por `SELECT` antes do `INSERT` (check-then-act), sem `UNIQUE` na tabela | Duas entregas concorrentes passam as duas e gravam **duas linhas** para o mesmo pagamento |
| 2 | Saldo atualizado por read-modify-write sem lock | O credito e aplicado duas vezes (ou perdido) |

O `BEGIN`/`COMMIT` que envolve tudo e uma **pista falsa**: em `READ COMMITTED`
(o default do Postgres) uma transacao nao protege contra lost update / double
apply. Se o candidato disser "ja tem transacao, entao esta seguro", explore isso
— e um dos melhores momentos da entrevista.

## Por que so adicionar a constraint nao resolve

A constraint faz **parte** da correcao — sem ela o `ON CONFLICT DO NOTHING` que
ja esta no codigo nunca dispara, entao as reentregas concorrentes gravam linha
duplicada. Mas adicionar **so** a constraint, sem gatear o credito pelo resultado
do `INSERT`, nao fecha o bug. E a armadilha principal do desafio.

Com `ALTER TABLE payments ADD CONSTRAINT payments_payment_id_status_key UNIQUE (payment_id, status)`
e o codigo como esta:

- o segundo `INSERT` passa a bater na constraint e o `ON CONFLICT DO NOTHING`
  engole o conflito -> a tabela `payments` volta a ter **uma linha** por
  pagamento (a duplicata some);
- mas o codigo nao olha `rowCount`, entao o fluxo segue e credita o saldo de novo
  do mesmo jeito -> o saldo continua dobrado e a conciliacao continua falhando.

A tabela muda, o dinheiro nao. A constraint protege a **linha**, nao o
**dinheiro**. Ela e **necessaria** (a idempotencia por `INSERT` depende dela),
mas so vale se o resultado do `INSERT` for **verificado** com `rowCount` e usado
para decidir se o efeito colateral roda.

> **Efeito colateral que surpreende (bom gancho de entrevista):** a `UNIQUE`
> tambem cria um indice, e duas entregas concorrentes do mesmo pagamento passam a
> **serializar** no `INSERT` — a segunda espera a primeira commitar. Isso torna a
> divergencia *mais* frequente **com** a constraint do que sem ela, porque forca
> a segunda entrega a ler o saldo ja creditado. Sem a constraint as duas rodam de
> fato em paralelo, muitas vezes leem o mesmo saldo e o lost update "cancela" a
> duplicata. Por isso, no schema como entregue (sem constraint), a reproducao e
> mais rara e nenhum valor de `RETRY_GAP` chega perto de 100% (ver "Como
> reproduzir"). E um otimo momento para falar sobre o que um indice unico faz
> alem de rejeitar duplicata.

## Correcao canonica

Uma mudanca de **schema** e duas de codigo. Primeiro a constraint que faltava —
a idempotencia por `INSERT` depende dela (deixe no `db/001_schema.sql`, ou aplique
com `ALTER TABLE`):

```sql
ALTER TABLE payments
  ADD CONSTRAINT payments_payment_id_status_key UNIQUE (payment_id, status);
```

Depois, em `applyPaymentEvent`:

```ts
// Idempotencia: o INSERT e o ponto de decisao. A unique em
// (payment_id, status) garante que so uma entrega grava a linha.
const inserted = await client.query(
  `INSERT INTO payments (payment_id, restaurant_id, amount, status)
        VALUES ($1, $2, $3, $4)
   ON CONFLICT (payment_id, status) DO NOTHING`,
  [event.payment_id, event.restaurant_id, event.amount, event.status]
);

if (inserted.rowCount === 0) {
  return { outcome: "duplicate" };
}

if (event.status !== "confirmed") {
  return { outcome: "recorded", status: event.status };
}

// Atomicidade: o banco soma sobre o valor corrente da linha.
const updated = await client.query(
  `UPDATE balances
      SET balance = balance + $1, updated_at = now()
    WHERE restaurant_id = $2
    RETURNING balance`,
  [event.amount, event.restaurant_id]
);
```

Os tres pontos importantes:

1. **A constraint tem que existir.** Sem `UNIQUE (payment_id, status)` o
   `ON CONFLICT` nao tem em que se apoiar e o `INSERT` nunca deduplica. Adicionar
   a constraint faz parte da correcao — nao e opcional.
2. **`rowCount === 0` decide** se o efeito colateral roda. O `SELECT` previo pode
   ate continuar existindo como fast path, mas nao pode ser a unica protecao.
3. **`balance = balance + $1`** dentro da transacao. O `UPDATE` pega lock na
   linha, entao as somas serializam e nenhuma se perde.

Verificado nesta maquina: com a constraint + as duas mudancas de codigo, a
conciliacao passou em 20/20 ciclos no default e 20/20 com `RETRY_GAP=2`.

E o log depois da correcao, no mesmo pagamento reentregue — a evidencia que o
candidato deveria mostrar:

```
payment.recorded    request_id=af2f7ae9 payment_id=pay_2026w34_0006 rows_inserted=1
balance.credited    request_id=af2f7ae9 payment_id=pay_2026w34_0006 balance_after=57.42
webhook.completed   request_id=af2f7ae9 outcome=credited  http_status=200
payment.recorded    request_id=5dee89a3 payment_id=pay_2026w34_0006 rows_inserted=0
webhook.completed   request_id=5dee89a3 outcome=duplicate http_status=200
```

Um `balance.credited` so, e o `rows_inserted=0` agora **corta** o fluxo em vez
de seguir para o credito. Comparar esse bloco com o de antes e a forma mais
direta de provar que a correcao pegou.

## Variacoes aceitaveis

O que importa e a combinacao **idempotencia + atomicidade**. Nenhuma das duas
sozinha fecha o bug.

**Idempotencia — nao creditar a reentrega:**

| Abordagem | Comentario |
|-----------|------------|
| `UNIQUE (payment_id, status)` + `ON CONFLICT ... DO NOTHING` + checar `rowCount` | A canonica. Exige adicionar a constraint no schema. |
| `pg_advisory_xact_lock(hashtext(payment_id))` antes da checagem | Serializa as entregas do mesmo pagamento sem constraint; a segunda ja ve a linha da primeira. Vale perguntar como escala. |
| `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` | Detecta o conflito (erro `40001`), **desde que** trate com retry. Sem retry, devolve 500 e o PSP reentrega — pergunte sobre isso. |
| `REPEATABLE READ` | Idem: detecta `40001` e tambem precisa de retry. |

**Atomicidade — nao perder/duplicar credito concorrente:**

| Abordagem | Comentario |
|-----------|------------|
| `UPDATE ... SET balance = balance + $1` | A canonica. Simples e sem retry. |
| `SELECT ... FOR UPDATE` no `balances` antes do read-modify-write | Correta para a atomicidade, mas **precisa** vir junto de uma idempotencia de verdade — sozinha nao impede o duplo credito da reentrega. |

**Modelagem — elimina as duas classes de uma vez:**

| Abordagem | Comentario |
|-----------|------------|
| Derivar o saldo de `payments` (`SUM` do distinct) em vez de manter coluna | Resposta forte de modelagem. Pergunte sobre custo de leitura e snapshot/ledger. |
| Tabela de ledger append-only + saldo materializado | Resposta senior. Como a Brendi faz de verdade em varios lugares. |

### Nao aceitar

- **So** adicionar a constraint (`UNIQUE`) sem gatear o credito pelo `rowCount` —
  deduplica a linha mas o saldo continua dobrado (secao acima).
- **So** trocar o `SELECT` de duplicidade de lugar — continua check-then-act.
- Retry/backoff na aplicacao sem tornar o credito idempotente — reduz a janela,
  nao fecha.
- Mutex em memoria no processo Node — quebra com mais de uma instancia. Otimo
  gancho: "e com 3 pods rodando?"
- Serializar tudo numa fila global — resolve, mas jogue o custo na mesa.

## Como reproduzir na hora da entrevista

A falha e intermitente de proposito. Medido nesta maquina (Docker Desktop no
macOS, `PG_POOL_MAX=8`, schema **sem** a constraint). A taxa depende de timing,
entao espere variacao entre maquinas — o que importa e que existe uma faixa
intermitente:

| Config | Falhas em 20 ciclos |
|--------|---------------------|
| `RETRY_GAP=2` (mais barulhento) | 8 (40%) |
| Default (`RETRY_GAP=6`) | 5 (25%) |
| `RETRY_GAP=0` / `RETRY_GAP=1` | 3 (15%) |

O `RETRY_GAP` controla quantos eventos da leva entram entre a entrega original e
a reentrega. `RETRY_GAP=2` deixa a divergencia mais provavel; gaps muito pequenos
aumentam a sobreposicao e o lost update tende a cancelar a duplicata; gaps
grandes deixam a primeira entrega commitar antes e a checagem de duplicidade pega
a segunda. **Sem a constraint, nenhum valor chega perto de 100%** — a
serializacao do indice unico, que garantia a reproducao quase deterministica,
saiu junto com ela (ver o box em "Por que so adicionar a constraint nao
resolve"). Para reproduzir de forma **confiavel**, use o roteiro de duas sessoes
de `psql` abaixo.

Variaveis aceitas pelo `load-webhooks` (de proposito **nao** documentadas no
README do candidato, para nao entregar a pista de reentrega):

| Variavel | Default | O que faz |
|----------|---------|-----------|
| `WAVES` | 4 | Quantas levas a fila do PSP tem (= pagamentos por restaurante) |
| `WAVE_SIZE` | 32 | Quantos restaurantes entram em cada leva |
| `DELIVERIES` | 2 | Quantas entregas o PSP fez de cada evento reentregue |
| `RETRY_GAP` | 6 | Quantos eventos da leva entram entre uma reentrega e a anterior |

A lista `REDELIVERED` no topo do script define quais eventos foram reentregues
(hoje tres, um em levas diferentes). Cuidado ao mexer: os slots **nao** sao
equivalentes — alguns caem numa posicao do pool que race com mais frequencia.
Ainda assim, no schema como entregue (sem constraint) a taxa nao passa muito de
~40%: a serializacao do indice unico, que levava a 100%, saiu junto com a
constraint. Adicionar mais eventos a `REDELIVERED` aumenta a taxa, mas nao a
crava.

Para deixar barulhento na hora da entrevista:

```bash
docker compose exec -e RETRY_GAP=2 app npm run check
```

Para reproduzir de forma **deterministica** (bom para mostrar no fim, ou se o
candidato chegar la sozinho — e a resposta ideal para "como voce reproduz?"),
basta forcar o interleaving com duas sessoes de `psql`:

```sql
-- sessao 1
BEGIN;
SELECT balance FROM balances WHERE restaurant_id = 'rest_pizza_roma';  -- 0.00

-- sessao 2
BEGIN;
SELECT balance FROM balances WHERE restaurant_id = 'rest_pizza_roma';  -- 0.00
UPDATE balances SET balance = 100 WHERE restaurant_id = 'rest_pizza_roma';
COMMIT;

-- sessao 1 (ainda com o valor velho em maos)
UPDATE balances SET balance = 100 WHERE restaurant_id = 'rest_pizza_roma';
COMMIT;
-- saldo final: 100, e nao 200 -> lost update
```

O mesmo experimento com `balance = balance + 100` nas duas sessoes termina em
200. E a demonstracao mais curta de que o problema esta no read-modify-write.

## Avaliando o uso de IA

IA e liberada e **o uso dela e um dos criterios**. O desafio foi montado para
que a IA ajude sem entregar: ela acha o defeito rapido lendo
`payment-service.ts`, mas a correcao que ela sugere primeiro costuma estar
incompleta.

### A armadilha que a IA cai

Pedindo "conserta esse handler de webhook idempotente", a sugestao mais comum e
alguma variacao de:

> adicione `UNIQUE (payment_id)` na tabela `payments` e use
> `INSERT ... ON CONFLICT DO NOTHING`

Adicionar a constraint e de fato **parte** da correcao — sem ela o
`ON CONFLICT DO NOTHING` que ja esta no codigo nunca dispara. Mas parar ai **nao
resolve**: a constraint deduplica a linha e o codigo continua creditando o saldo
de novo, porque nao olha o resultado do `INSERT`. E o melhor momento do desafio:
a sugestao e plausivel, meio-certa, e incompleta aqui — o candidato so percebe se
verificar o saldo (e a conciliacao) depois de aplicar.

O que separa os candidatos nao e receber essa sugestao — e o que fazem com ela.

### Os logs sao a prova, e existem de proposito

Um candidato que investiga em vez de aceitar tem tudo em maos:

```bash
docker compose logs app | grep pay_2026w34_0006
```

```
payment.dedup_check  request_id=c771bcad  rows_found=0
payment.dedup_check  request_id=c3dc1605  rows_found=0
payment.recorded     request_id=c771bcad  rows_inserted=1
payment.recorded     request_id=c3dc1605  rows_inserted=1
balance.credited     request_id=c771bcad  balance_before=0.00   balance_after=57.42
balance.credited     request_id=c3dc1605  balance_before=57.42  balance_after=114.84
```

As tres coisas que essas seis linhas provam, sem precisar de teoria:

| Linha | Prova |
|-------|-------|
| dois `rows_found=0` para o mesmo `payment_id` | a checagem de duplicidade e check-then-act e as duas entregas passaram |
| dois `rows_inserted=1` | sem constraint, as duas gravaram linha — o pagamento esta **duplicado** na tabela |
| `balance_before` diferente nas duas | o credito e read-modify-write, cada um partiu do valor que leu -> saldo dobrado |

Depois de adicionar a constraint (a sugestao da IA), o mesmo `grep` passa a
mostrar `rows_inserted=1` seguido de `rows_inserted=0` — a linha para de duplicar
— mas o `balance_after=114.84` continua aparecendo e a conciliacao continua
falhando. E a prova, por evidencia direta, de que a constraint sozinha nao fecha
o bug.

Num ciclo que passou aparece `rows_found=1` -> `outcome=duplicate`. Comparar um
ciclo que falhou com um que passou e o caminho mais curto para o diagnostico.

### O que observar

**Uso forte de IA**
- Usa a IA para acelerar leitura ("me explique o fluxo desse handler"), e faz o
  diagnostico com evidencia do log/banco
- Recebe a sugestao da UNIQUE, aplica e **testa**; percebe que limpa o extrato
  mas o saldo continua dobrado, e completa a correcao (gatear pelo `rowCount` +
  soma atomica)
- Da contexto real para a IA (schema, log de um ciclo que falhou), em vez de so
  colar o arquivo
- Percebe quando a IA erra e corrige o rumo, sem abandonar a ferramenta
- Sabe explicar a correcao final com as proprias palavras, incluindo o que
  descartou no caminho

**Uso fraco de IA**
- Cola o arquivo, aplica o primeiro patch e roda `check` uma vez — se passou,
  declara resolvido (no default o `check` fica verde ~75% das vezes, entao um
  unico ciclo nao prova nada)
- Aplica a UNIQUE porque a IA falou, sem verificar, e nao sabe dizer o que ela
  protege
- Nao consegue explicar o codigo que colou
- Ignora os logs — sinal mais forte de todos, porque a evidencia estava pronta
- Vai empilhando sugestoes (transacao + retry + lock + isolamento) sem entender
  qual resolveu o que

### Perguntas para calibrar

Probes rapidos da Parte 1. Para cada um, o que soa fraco vs forte:

- **"A IA sugeriu isso. Como voce sabe que funciona?"**
  Fraca: "rodei e passou" (um ciclo). Forte: mostra o antes/depois com evidencia
  (log + conciliacao repetida).
- **"Roda de novo umas cinco vezes. Ainda esta confiante?"**
  Fraca: confia no primeiro verde. Forte: sabe que o verde e ~75% por sorte e
  roda ate estabilizar (ou sobe a carga / `RETRY_GAP=2`).
- **"Essa constraint que voce adicionou protege o que, exatamente?"**
  Fraca: "evita duplicados" e para ai. Forte: "protege a linha, nao o dinheiro" —
  por isso o credito ainda precisa gatear pelo `rowCount`.
- **"Me mostre no log o momento em que o bug acontece."**
  Fraca: nao sabe onde olhar. Forte: aponta os dois `rows_found=0`, os
  `rows_inserted=1` e o `balance_before` diferente.
- **"Se eu tirar essa linha da sua correcao, o que quebra?"**
  Fraca: nao sabe. Forte: explica o papel de cada parte (constraint, gate do
  `rowCount`, soma atomica) e o que cada uma cobre.

Vale registrar o prompt que o candidato usou. Prompt vago com resultado aceito
sem critica e um sinal; prompt com contexto e verificacao posterior e outro.

## Roteiro de perguntas para a Parte 2

Gabarito de consulta rapida para calibrar nivel ao vivo. Cada bloco: o que soa
**Fraco**, o que basta (**Aceitavel**), o que puxa para **Forte (senior)**, e por
que a pergunta importa.

### 1. Direcao do erro — o saldo pode ficar *menor*?
"Aqui o saldo ficou maior. O mesmo bug pode fazer o saldo ficar menor?"
- **Fraca:** "Nao, sempre maior." Nao enxerga o lost update.
- **Aceitavel:** Sim — dois pagamentos *diferentes* do mesmo restaurante chegando
  juntos causam lost update e o saldo fica menor; nota que o `load-webhooks`
  isola o "maior" mandando 1 pagamento/restaurante por leva.
- **Forte:** Ve que "maior" (double-apply da reentrega) e "menor" (lost update de
  pagamentos distintos) sao o mesmo read-modify-write sem lock, e que
  `balance = balance + $1` fecha os dois.
- **Por que importa:** separa sintoma de causa; prova que entendeu o mecanismo,
  nao so o caso do ticket.

### 2. Idempotencia de verdade — reentrega 3 dias depois? com `amount` diferente?
- **Fraca:** "A constraint resolve", cobrindo so a janela concorrente.
- **Aceitavel:** A dedup por `(payment_id, status)` vale para sempre, nao so na
  janela; reconhece que o codigo confia no payload e nao compara `amount`.
- **Forte:** Trata `amount` divergente como incidente (rejeita/alerta em vez de
  sobrescrever); discute a chave de idempotencia certa (event_id do PSP vs
  payment_id) e a semantica de status (confirmed apos failed).
- **Por que importa:** idempotencia e a *chave certa* + o que fazer no conflito,
  nao so evitar linha duplicada.

### 3. Concorrencia entre instancias — aguenta 3 replicas?
- **Fraca:** Propoe mutex/lock em memoria no processo Node.
- **Aceitavel:** A garantia tem que estar no banco (constraint + UPDATE atomico),
  entao N replicas sao seguras; mutex em memoria quebraria.
- **Forte:** Discute onde o lock vive (linha via UPDATE, advisory lock,
  serializable+retry) e o custo sob varias replicas; menciona pool de conexoes.
- **Por que importa:** distingue correcao que escala horizontal de gambiarra de
  processo unico.

### 4. Modelagem — coluna mutavel vs ledger append-only?
"Manter `balances.balance` como coluna vale a pena, ou um ledger com saldo
derivado e melhor?"
- **Fraca:** "Tanto faz" / nao justifica.
- **Aceitavel:** Coluna mutavel e simples e rapida de ler mas facil de corromper;
  ledger append-only + saldo derivado e auditavel e mata a classe do bug. Sabe
  quando usar cada um.
- **Forte:** Trade-off de custo de leitura (SUM vs coluna) + saldo materializado/
  snapshot; por que financas tende a ledger; conecta com a conciliacao.
- **Por que importa:** sai do patch e vai para o design — separa mid de senior.

### 5. Deteccao — conciliacao 1x/dia; como pegar em minutos?
- **Fraca:** "Rodar a conciliacao mais vezes."
- **Aceitavel:** Alerta de divergencia (metrica saldo vs soma) e/ou conciliacao
  continua.
- **Forte:** Invariante checada no proprio commit (constraint/trigger/CHECK),
  alerta com SLO, e a diferenca entre *detectar* e *prevenir*.
- **Por que importa:** maturidade de observabilidade em sistema que mexe com
  dinheiro.

### 6. Correcao do passado — ja pagamos a mais; como consertar historicos?
- **Fraca:** `UPDATE` manual no saldo, sem trilha.
- **Aceitavel:** Recalcular o saldo a partir dos pagamentos reais (distinct), num
  processo idempotente e auditavel, com backup/dry-run antes.
- **Forte:** Reconstruir da fonte da verdade (ledger), lancar ajuste explicito em
  vez de sobrescrever, reconciliar repasses ja feitos e comunicar o impacto.
- **Por que importa:** em financas, corrigir o passado sem apagar historico e tao
  importante quanto parar o bug.

### 7. Teste de regressao — pega no CI sem ser flaky?
- **Fraca:** "Rodar o load varias vezes" — flaky, depende de timing.
- **Aceitavel:** Forcar o interleaving deterministico com duas conexoes e uma
  barreira, em vez de depender de concorrencia real; asserta o saldo final.
- **Forte:** Teste deterministico do lost update *e* do double-apply, mais um
  teste da invariante de conciliacao como safety net; roda no CI.
- **Por que importa:** teste flaky nao protege — o candidato tem que saber tornar
  a corrida deterministica.

> **Se o tempo apertar (30 min ao vivo):** nao da para cobrir as 7. Nucleo **1, 2,
> 7** (mecanismo, idempotencia de verdade, como provar). **3/4/5/6** conforme o
> nivel e o tempo — 4 e 6 puxam para senior.

## Sinais de avaliacao

**Forte**
- Reproduz de forma controlada antes de mexer no codigo
- Vai ao log e traz a evidencia: os dois `rows_found=0` e os dois
  `rows_inserted=1` (a linha duplicada), com `balance_before` diferente
- Le o `payments`, nota o pagamento **duplicado** e o saldo dobrado, e separa os
  dois defeitos (extrato x saldo)
- Corrige idempotencia (incluindo a constraint) **e** atomicidade, e explica por
  que uma sem a outra nao basta
- Nao se satisfaz com "rodei e passou"; roda varias vezes ou aumenta a carga
- Se usou IA: verificou o que ela sugeriu antes de aplicar, e sabe explicar o
  patch final com as proprias palavras

**Medio**
- Acha o read-modify-write e corrige o `UPDATE`, mas deixa o check-then-act
- Chega no diagnostico so lendo codigo, sem nunca abrir o log — chega la, mas
  nao demonstra o habito de confirmar com evidencia
- Corrige na base de tentativa e erro, sem explicar o mecanismo
- Precisa de dica para perceber que a UNIQUE sozinha nao resolve

**Fraco**
- Adiciona a constraint, ve um `check` passar por sorte e declara resolvido —
  sem notar que o extrato limpou mas o saldo continua dobrado (e passa a divergir
  ate com mais frequencia sob carga). Um unico ciclo verde nao prova nada
- Aplica patch de IA que nao sabe explicar
- Ignora os logs mesmo depois de ser perguntado sobre evidencia
- Culpa o PSP e propoe so aumentar timeout ou tratar retry
- Nao consegue explicar por que o problema e intermitente

## Checklist rapido do avaliador

Antes de comecar:

- [ ] `SOLUTION.md` removido do repo que vai para o candidato
- [ ] `docker compose down -v && docker compose up --build` roda limpo
- [ ] `docker compose exec app npm run check` algumas vezes, confirmando que
      alterna entre OK e FALHA nessa maquina

Durante:

- [ ] Anotar o prompt que o candidato usou e o que ele fez com a resposta
- [ ] Perguntar "qual a evidencia?" pelo menos uma vez
- [ ] Pedir para rodar o `check` cinco vezes depois da correcao
