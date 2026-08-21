import { closePool, withClient } from "../src/db";

/** Diferencas abaixo de meio centavo sao ruido de arredondamento. */
const TOLERANCE = 0.005;

interface ReconciliationRow {
  restaurant_id: string;
  name: string;
  balance: string;
  confirmed_total: string;
  confirmed_count: string;
}

/**
 * Conciliacao do ledger.
 *
 * O saldo consolidado de um restaurante tem que ser exatamente a soma dos
 * pagamentos confirmados que ele recebeu. Qualquer diferenca e dinheiro que
 * aparece (ou desaparece) do repasse.
 *
 * Cada pagamento entra na soma uma unica vez: o DISTINCT ON (payment_id)
 * colapsa reentregas que porventura tenham gravado mais de uma linha para o
 * mesmo pagamento, entao o total esperado reflete os pagamentos reais, nao o
 * numero de linhas na tabela.
 */
async function loadRows(): Promise<ReconciliationRow[]> {
  return withClient(async (client) => {
    const { rows } = await client.query<ReconciliationRow>(
      `SELECT r.id   AS restaurant_id,
              r.name AS name,
              b.balance,
              COALESCE(p.total, 0) AS confirmed_total,
              COALESCE(p.count, 0) AS confirmed_count
         FROM restaurants r
         JOIN balances b ON b.restaurant_id = r.id
         LEFT JOIN (
                SELECT restaurant_id,
                       SUM(amount) AS total,
                       COUNT(*)    AS count
                  FROM (
                         SELECT DISTINCT ON (payment_id)
                                payment_id, restaurant_id, amount
                           FROM payments
                          WHERE status = 'confirmed'
                       ORDER BY payment_id
                       ) confirmed
              GROUP BY restaurant_id
         ) p ON p.restaurant_id = r.id
     ORDER BY r.name`
    );

    return rows;
  });
}

function money(value: number): string {
  return value.toFixed(2).padStart(12);
}

interface PaymentRow {
  payment_id: string;
  amount: string;
  received_at: string;
}

/** Pagamentos confirmados que deveriam compor o saldo do restaurante. */
async function loadPayments(restaurantId: string): Promise<PaymentRow[]> {
  return withClient(async (client) => {
    const { rows } = await client.query<PaymentRow>(
      `SELECT payment_id,
              amount,
              to_char(received_at, 'HH24:MI:SS.MS') AS received_at
         FROM payments
        WHERE restaurant_id = $1
          AND status = 'confirmed'
     ORDER BY received_at`,
      [restaurantId]
    );

    return rows;
  });
}

async function main(): Promise<void> {
  const rows = await loadRows();

  const divergent = rows.filter(
    (row) => Math.abs(Number(row.balance) - Number(row.confirmed_total)) >= TOLERANCE
  );

  const totalBalance = rows.reduce((sum, row) => sum + Number(row.balance), 0);
  const totalConfirmed = rows.reduce((sum, row) => sum + Number(row.confirmed_total), 0);
  const totalPayments = rows.reduce((sum, row) => sum + Number(row.confirmed_count), 0);

  console.log("CONCILIACAO DE SALDOS\n");
  console.log(`  restaurantes conciliados  ${String(rows.length).padStart(6)}`);
  console.log(`  pagamentos confirmados    ${String(totalPayments).padStart(6)}`);
  console.log(`  soma dos pagamentos       ${money(totalConfirmed)}`);
  console.log(`  soma dos saldos           ${money(totalBalance)}`);
  console.log(`  diferenca                 ${money(totalBalance - totalConfirmed)}`);

  if (divergent.length === 0) {
    console.log("\nOK: todos os saldos batem com os pagamentos confirmados.");
    return;
  }

  console.log(`\nFALHA: ${divergent.length} restaurante(s) com saldo divergente.\n`);
  console.log(
    "  restaurante                 pagamentos     esperado        saldo         diff"
  );
  console.log("  " + "-".repeat(76));

  for (const row of divergent) {
    const balance = Number(row.balance);
    const expected = Number(row.confirmed_total);

    console.log(
      "  " +
        [
          row.name.padEnd(26),
          String(row.confirmed_count).padStart(8),
          money(expected),
          money(balance),
          money(balance - expected),
        ].join(" ")
    );
  }

  // Detalha os pagamentos de cada restaurante divergente, para dar para cruzar
  // o desvio com os eventos que o PSP entregou.
  for (const row of divergent) {
    const payments = await loadPayments(row.restaurant_id);

    console.log(`\n  ${row.name} (${row.restaurant_id})`);
    console.log("    pagamentos confirmados na tabela payments:");

    for (const payment of payments) {
      console.log(
        `      ${payment.payment_id}  ${Number(payment.amount).toFixed(2).padStart(10)}  ${payment.received_at}`
      );
    }

    console.log(
      `      ${"soma".padEnd(16)}  ${Number(row.confirmed_total).toFixed(2).padStart(10)}`
    );
    console.log(
      `      ${"saldo em balances".padEnd(16)}  ${Number(row.balance).toFixed(2).padStart(10)}`
    );
    console.log(
      `      ${"diferenca".padEnd(16)}  ${(Number(row.balance) - Number(row.confirmed_total)).toFixed(2).padStart(10)}`
    );
  }

  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closePool);
