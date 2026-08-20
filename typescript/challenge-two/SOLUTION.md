# SOLUTION — guia do avaliador

> **Remova este arquivo antes de enviar o desafio ao candidato.**

## Resumo

O bug e uma race condition no credito de saldo. O handler do webhook faz
**read-modify-write** no saldo (`SELECT balance` -> soma em memoria ->
`UPDATE balance = <valor calculado>`) e usa uma checagem de duplicidade do tipo
**check-then-act**. Quando o PSP reentrega o mesmo evento e as duas entregas se
sobrepoem, as duas passam pela checagem e as duas creditam.

A tabela `payments` fica **correta** (uma linha por pagamento) porque existe
`UNIQUE (payment_id, status)` e o `INSERT` usa `ON CONFLICT DO NOTHING`. O
efeito colateral duplicado esta somente no saldo — e por isso que o sintoma e
"saldo maior que a soma dos pagamentos".

A janela do `load-webhooks` manda 128 pagamentos confirmados (4 levas x 32
restaurantes), entao o saldo de cada restaurante e a soma de 4 pagamentos e o
desvio de um deles fica diluido no total. Nao da para achar o problema
"de olho" no saldo: so a conciliacao mostra.

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

// 2. o INSERT engole o conflito em silencio e o fluxo continua
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
| 1 | Idempotencia por `SELECT` antes do `INSERT` (check-then-act) | Duas entregas concorrentes passam as duas |
| 2 | Saldo atualizado por read-modify-write sem lock | O credito e aplicado duas vezes (ou perdido) |

O `BEGIN`/`COMMIT` que envolve tudo e uma **pista falsa**: em `READ COMMITTED`
(o default do Postgres) uma transacao nao protege contra lost update / double
apply. Se o candidato disser "ja tem transacao, entao esta seguro", explore isso
— e um dos melhores momentos da entrevista.

## Por que so a UNIQUE em payment_id nao resolve

E a armadilha principal do desafio. Verificado na pratica.

Rodando com `RETRY_GAP=2` (configuracao em que a race acontece de forma quase
deterministica, para a comparacao nao ficar mascarada pela intermitencia):

| Schema | Resultado em 12 ciclos de `npm run check` |
|--------|-------------------------------------------|
| Como entregue | `ok=0  falhou=12` |
| Depois de `ALTER TABLE payments ADD CONSTRAINT payments_payment_id_key UNIQUE (payment_id);` | `ok=0  falhou=12` |

Identico — 12 de 12 nos dois casos.

Identico. E o detalhe que fecha o argumento — com a UNIQUE **ativa**, os tres
eventos reentregues tem exatamente uma linha cada:

```
    payment_id    | linhas_payments |  soma
------------------+-----------------+--------
 pay_2026w34_0006 |               1 |  57.42
 pay_2026w34_1021 |               1 | 116.87
 pay_2026w34_2013 |               1 | 103.41
```

E a conciliacao do mesmo ciclo:

```
FALHA: 2 restaurante(s) com saldo divergente.

  restaurante                 pagamentos     esperado        saldo         diff
  Emporio Sao Paulo                 4       389.84       493.25       103.41
  Pescados do Porto                 4       491.28       608.15       116.87
```

As linhas estao deduplicadas e o dinheiro continua contado duas vezes — cada
`diff` e exatamente o valor de um dos pagamentos reentregues.
A constraint protege a **linha**, nao o **dinheiro**: com
`ON CONFLICT DO NOTHING` o conflito e engolido em silencio e o fluxo segue para
o credito do mesmo jeito.

Moral: idempotencia so vale se o resultado do `INSERT` for **verificado** e usado
para decidir se o efeito colateral roda.

## Correcao canonica

Duas mudancas em `applyPaymentEvent`, sem tocar no schema:

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

Os dois pontos importantes:

1. **`rowCount === 0` decide** se o efeito colateral roda. O `SELECT` previo
   pode ate continuar existindo como fast path, mas nao pode ser a unica
   protecao.
2. **`balance = balance + $1`** dentro da transacao. O `UPDATE` pega lock na
   linha, entao as somas serializam e nenhuma se perde.

Verificado: 27 ciclos sem nenhuma divergencia — 15 na configuracao default e 12
com `RETRY_GAP=2` (configuracao em que o bug falha 12/12).

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

Todas resolvem. O que importa e a combinacao **idempotencia + atomicidade**.

| Abordagem | Comentario |
|-----------|------------|
| `UPDATE ... SET balance = balance + $1` | A canonica. Simples e sem retry. |
| `SELECT ... FOR UPDATE` no `balances` antes do read-modify-write | Correta. Mantem o calculo na aplicacao; lock explicito e mais facil de explicar. |
| `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` | Correta, **desde que** trate `40001` com retry. Se nao tratar, o webhook devolve 500 e o PSP reentrega — pergunte sobre isso. |
| `REPEATABLE READ` | Tambem detecta o conflito no Postgres (erro 40001) e tambem precisa de retry. |
| Lock pessimista via `pg_advisory_xact_lock(payment_id)` | Funciona e serializa por pagamento. Vale perguntar como isso escala. |
| Derivar o saldo de `payments` (`SUM`) em vez de manter coluna | Resposta forte de modelagem. Elimina a classe do bug inteira. Pergunte sobre custo de leitura e snapshot/ledger. |
| Tabela de ledger append-only + saldo materializado | Resposta senior. Como a Brendi faz de verdade em varios lugares. |

### Nao aceitar

- **So** adicionar `UNIQUE (payment_id)` — nao resolve (secao acima).
- **So** trocar o `SELECT` de duplicidade de lugar — continua check-then-act.
- Retry/backoff na aplicacao sem tornar o credito idempotente — reduz a janela,
  nao fecha.
- Mutex em memoria no processo Node — quebra com mais de uma instancia. Otimo
  gancho: "e com 3 pods rodando?"
- Serializar tudo numa fila global — resolve, mas jogue o custo na mesa.

## Como reproduzir na hora da entrevista

A falha e intermitente de proposito. Medido nesta maquina (Docker Desktop no
macOS, `PG_POOL_MAX=8`). A taxa depende de timing, entao espere variacao entre
maquinas — o que importa e que existe uma faixa intermitente e que os knobs
deslocam ela:

| Config | Falhas (container) |
|--------|--------------------|
| Default (`RETRY_GAP=6`) | 8 em 20 (40%) |
| `RETRY_GAP=4` | 10 em 12 (83%) |
| `RETRY_GAP=2` | 12 em 12 (100%) |

O `RETRY_GAP` e o knob principal: ele controla quantos eventos da leva entram
entre a entrega original e a reentrega. Gap pequeno = as duas entregas caem na
mesma leva de conexoes do pool e as duas creditam. Gap grande = a primeira ja
commitou e a checagem de duplicidade pega a segunda.

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
equivalentes — slots como 13 e 27 caem numa posicao do pool que race quase
sempre, e adicionar um deles leva a taxa para 100%.

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

Nesse codigo isso **nao resolve** (secao acima: 12/12 falhas com e sem a
constraint). O `ON CONFLICT DO NOTHING` ja esta la, o conflito e engolido em
silencio e o credito roda de novo. E o melhor momento do desafio: a sugestao e
plausivel, tecnicamente correta em abstrato, e errada aqui.

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
payment.recorded     request_id=c3dc1605  rows_inserted=0
balance.credited     request_id=c771bcad  balance_before=0.00   balance_after=57.42
balance.credited     request_id=c3dc1605  balance_before=57.42  balance_after=114.84
```

As tres coisas que essas seis linhas provam, sem precisar de teoria:

| Linha | Prova |
|-------|-------|
| dois `rows_found=0` para o mesmo `payment_id` | a checagem de duplicidade e check-then-act e as duas entregas passaram |
| `rows_inserted=0` seguido de `balance.credited` | a constraint funcionou na **linha** e o dinheiro entrou de novo — refuta a sugestao da IA por evidencia direta |
| `balance_before` diferente nas duas | o credito e read-modify-write, cada um partiu do valor que leu |

Num ciclo que passou aparece `rows_found=1` -> `outcome=duplicate`. Comparar um
ciclo que falhou com um que passou e o caminho mais curto para o diagnostico.

### O que observar

**Uso forte de IA**
- Usa a IA para acelerar leitura ("me explique o fluxo desse handler"), e faz o
  diagnostico com evidencia do log/banco
- Recebe a sugestao da UNIQUE e **testa** antes de aceitar; conclui que nao
  resolve e explica por que (o `rows_inserted=0` + credito)
- Da contexto real para a IA (schema, log de um ciclo que falhou), em vez de so
  colar o arquivo
- Percebe quando a IA erra e corrige o rumo, sem abandonar a ferramenta
- Sabe explicar a correcao final com as proprias palavras, incluindo o que
  descartou no caminho

**Uso fraco de IA**
- Cola o arquivo, aplica o primeiro patch e roda `check` uma vez — se passou,
  declara resolvido (o desafio passa ~40% das vezes por sorte)
- Aplica a UNIQUE porque a IA falou, sem verificar, e nao sabe dizer o que ela
  protege
- Nao consegue explicar o codigo que colou
- Ignora os logs — sinal mais forte de todos, porque a evidencia estava pronta
- Vai empilhando sugestoes (transacao + retry + lock + isolamento) sem entender
  qual resolveu o que

### Perguntas para calibrar

- "A IA sugeriu isso. Como voce sabe que funciona?"
- "Roda de novo umas cinco vezes. Ainda esta confiante?"
- "Essa constraint que voce adicionou protege o que, exatamente?"
- "Me mostre no log o momento em que o bug acontece."
- "Se eu tirar essa linha da sua correcao, o que quebra?"

Vale registrar o prompt que o candidato usou. Prompt vago com resultado aceito
sem critica e um sinal; prompt com contexto e verificacao posterior e outro.

## Roteiro de perguntas para a Parte 2

1. **Direcao do erro.** Aqui o saldo ficou *maior*. O mesmo bug pode fazer o
   saldo ficar *menor*? (Sim — dois pagamentos **diferentes** do mesmo
   restaurante chegando juntos causam lost update. Por isso o `load-webhooks`
   manda no maximo um pagamento por restaurante **por leva**, e espera a leva
   terminar antes de comecar a proxima: e o que isola o cenario do ticket. Otima
   pergunta de follow-up: "e se dois pedidos do mesmo restaurante confirmarem no
   mesmo segundo?" — e se o candidato remover essa serializacao do script, o
   saldo passa a ficar *menor* que a soma dos pagamentos.)
2. **Idempotencia de verdade.** E se o PSP reentregar o evento tres dias depois?
   E se reentregar com `amount` diferente? (Hoje o codigo confia no payload e nao
   compara valor.)
3. **Concorrencia entre instancias.** A correcao aguenta 3 replicas do servico?
4. **Modelagem.** Manter `balances.balance` como coluna mutavel vale a pena, ou
   um ledger append-only com saldo derivado e melhor? Quando cada um?
5. **Deteccao.** Essa conciliacao roda uma vez por dia. Como voce descobriria
   isso em minutos e nao em um fechamento de mes? (Alertas de divergencia,
   conciliacao continua, invariante checada no proprio commit.)
6. **Correcao do passado.** Ja pagamos repasse a mais. Como voce corrige os
   saldos historicos com seguranca?
7. **Teste de regressao.** Como voce escreve um teste que pega essa regressao no
   CI sem ser flaky? (Forcar o interleaving com duas conexoes e barreira, em vez
   de confiar em concorrencia real.)

## Sinais de avaliacao

**Forte**
- Reproduz de forma controlada antes de mexer no codigo
- Vai ao log e traz a evidencia: os dois `rows_found=0`, o `rows_inserted=0`
  seguido de `balance.credited`
- Le o `payments` e nota que a linha esta certa e o saldo nao — e usa isso para
  isolar o defeito
- Corrige idempotencia **e** atomicidade, e explica por que uma sem a outra nao
  basta
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
- Adiciona `UNIQUE (payment_id)`, ve um `check` passar e declara resolvido — o
  desafio passa ~40% das vezes por sorte, entao um unico ciclo verde nao prova
  nada
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
