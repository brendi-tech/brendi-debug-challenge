# Desafio Tecnico — Payment Webhooks (Node.js + Postgres)

## Contexto

Voce entrou no time de Finance da Brendi. Esse time e responsavel pelo dinheiro
que passa pela plataforma: o cliente paga o pedido, o PSP (o provedor de
pagamentos) processa a transacao e nos precisamos creditar o valor no saldo do
restaurante. Esse saldo e o que o restaurante ve no app do parceiro e e a base
do repasse que ele recebe no fim do ciclo.

A integracao funciona por webhook: sempre que o status de um pagamento muda, o
PSP faz um `POST` no nosso endpoint. Quando o status chega como `confirmed`, o
servico credita o valor no saldo consolidado do restaurante.

Todo dia roda uma conciliacao que confere uma unica regra:

> o saldo consolidado de um restaurante tem que ser exatamente a soma dos
> pagamentos confirmados que ele recebeu.

## O problema relatado

Abriram um ticket para o time:

> "De tempos em tempos o saldo consolidado de um restaurante fica maior que a
> soma dos pagamentos que ele realmente recebeu. Nao e todo dia e nao e sempre o
> mesmo restaurante. Quando a gente vai conferir, os pagamentos na tabela estao
> certos — o saldo e que esta errado. Ja pagamos repasse a mais por causa disso."

O time de Finance esta reprocessando planilha na mao para fechar o mes.
Ninguem conseguiu reproduzir o problema de forma confiavel ainda.

## Requisitos

- Docker e Docker Compose
- (opcional) Node.js 18+ e npm, se voce quiser rodar os scripts fora do container

## Como rodar

```bash
docker compose up --build
```

Isso sobe dois containers:

- `db` — Postgres com o schema e os dados iniciais ja aplicados
- `app` — o servico HTTP em `http://localhost:5070` (com hot reload: editar
  qualquer arquivo em `src/` reinicia o servidor sozinho)

Confira que subiu:

```bash
curl http://localhost:5070/health
```

### Simulando uma janela de pagamentos

O repo tem dois scripts que reproduzem o cenario de producao. Rode em outro
terminal, com o `docker compose up` ligado:

```bash
# dispara uma janela de eventos do PSP contra o servico
docker compose exec app npm run load

# confere se os saldos batem com os pagamentos confirmados
docker compose exec app npm run reconcile

# os dois em sequencia
docker compose exec app npm run check
```

A conciliacao sai com codigo 0 quando tudo bate e codigo 1 quando encontra
divergencia, mostrando os restaurantes afetados.

> Rode `npm run check` mais de uma vez antes de tirar conclusoes.

Se preferir rodar os scripts direto na sua maquina (fora do container), use
`npm install` e depois `npm run check` — eles falam com o Postgres em
`localhost:5433` e com o servico em `localhost:5070`.

## Sua missao

### Parte 1 — Debug (primeiros ~30 min)

Encontre a causa do problema relatado no ticket e corrija.

Uma correcao boa aqui:

- faz a conciliacao passar de forma **consistente**, nao por sorte
- continua correta se a janela de eventos dobrar de tamanho
- nao depende de o PSP se comportar bem

Duas perguntas que vamos te fazer, entao vale ja ir pensando nelas:

1. **Como voce reproduz?** Uma correcao que voce nao sabe reproduzir o problema
   antes e uma correcao que voce nao sabe se funcionou.
2. **Qual a evidencia?** Nao basta "rodei e passou". Mostre no log, no banco ou
   na conciliacao o que estava acontecendo antes e o que mudou depois.

Isso vale tambem — e principalmente — para hipoteses que vierem de uma IA. Elas
costumam ser plausiveis; algumas estao erradas. O servico tem log e banco
acessiveis justamente para voce conseguir separar as duas coisas.

### Parte 2 — Discussao (ultimos ~30 min)

Vamos conversar sobre o que voce encontrou, alternativas de correcao,
trade-offs e o que mais voce mudaria nesse servico se ele fosse seu.

## Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/webhooks/payment` | Recebe eventos de pagamento do PSP |
| GET | `/restaurants/:id/balance` | Saldo consolidado do restaurante |
| GET | `/health` | Healthcheck |

Payload do webhook:

```json
{
  "payment_id": "pay_9f2c1a47",
  "restaurant_id": "rest_pizza_roma",
  "amount": 87.50,
  "status": "confirmed"
}
```

`status` aceita `pending`, `confirmed` ou `failed`. Apenas `confirmed` credita
saldo; os outros ficam registrados para auditoria.

## Arquivos do projeto

| Arquivo | O que faz |
|---------|-----------|
| `src/app.ts` | Servidor Express e rotas |
| `src/db.ts` | Pool de conexoes com o Postgres |
| `src/logger.ts` | Logger estruturado (logfmt) |
| `src/payments/types.ts` | Tipos e validacao do payload do webhook |
| `src/payments/payment-service.ts` | Processamento do evento de pagamento |
| `src/restaurants/balance-repository.ts` | Consulta de saldo |
| `db/001_schema.sql` | Schema (tabelas `restaurants`, `balances`, `payments`) |
| `db/002_seed.sql` | Restaurantes iniciais |
| `scripts/load-webhooks.ts` | Dispara uma janela de eventos do PSP |
| `scripts/reconcile.ts` | Conciliacao: saldo vs pagamentos confirmados |
| `scripts/reset-ledger.ts` | Zera pagamentos e saldos |

## Investigando

O servico loga um evento por etapa do processamento, em logfmt, com um
`request_id` por entrega — da para amarrar as linhas de uma mesma requisicao
mesmo quando varias estao em voo ao mesmo tempo.

```bash
# acompanhar em tempo real
docker compose logs -f app

# tudo que aconteceu com um pagamento especifico
docker compose logs app | grep pay_2026w34_0006

# uma entrega especifica, de ponta a ponta
docker compose logs app | grep <request_id>
```

Quando a conciliacao acha divergencia, ela lista os pagamentos confirmados que
deveriam compor o saldo daquele restaurante, com horario de chegada — da para
cruzar o desvio com os eventos que o PSP entregou.

## Acessando o banco

```bash
docker compose exec db psql -U brendi -d brendi_payments
```

## Regras

- Voce pode usar Google e **ferramentas de IA** (ChatGPT, Claude, Copilot, o que
  voce usa no dia-a-dia) livremente
- **Como voce usa IA faz parte da avaliacao.** Nao e sobre usar ou nao usar: e
  sobre como voce conduz. Queremos ver que hipotese voce levanta, o que voce
  pergunta, e principalmente **como voce confirma ou descarta** o que vem de
  volta. Uma resposta plausivel que ninguem verificou nao vale nada num sistema
  que mexe com dinheiro.
- Compartilhe a tela e pense em voz alta, inclusive quando estiver conversando
  com a IA — queremos acompanhar seu raciocinio, nao so o resultado
- **Nao reescreva o projeto do zero** — corrija o codigo existente
