import { PoolClient } from "pg";
import { withClient } from "../db";
import { logger, logMoney } from "../logger";
import { PaymentEvent } from "./types";

export type ProcessResult =
  | { outcome: "credited"; balance: number }
  | { outcome: "duplicate" }
  | { outcome: "recorded"; status: string }
  | { outcome: "unknown_restaurant" };

/** Arredonda para centavos — o saldo e persistido como NUMERIC(12,2). */
function toMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Processa um evento de pagamento entregue pelo PSP.
 *
 * Pagamentos confirmados creditam o saldo consolidado do restaurante; os outros
 * status sao apenas registrados para auditoria e conciliacao.
 */
export async function processPaymentEvent(
  event: PaymentEvent,
  requestId: string
): Promise<ProcessResult> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    logger.info("tx.begin", { request_id: requestId, payment_id: event.payment_id });

    try {
      const result = await applyPaymentEvent(client, event, requestId);
      await client.query("COMMIT");
      logger.info("tx.commit", {
        request_id: requestId,
        payment_id: event.payment_id,
        outcome: result.outcome,
      });
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("tx.rollback", {
        request_id: requestId,
        payment_id: event.payment_id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });
}

async function applyPaymentEvent(
  client: PoolClient,
  event: PaymentEvent,
  requestId: string
): Promise<ProcessResult> {
  const restaurant = await client.query(
    "SELECT id FROM restaurants WHERE id = $1",
    [event.restaurant_id]
  );

  if (restaurant.rowCount === 0) {
    logger.warn("payment.unknown_restaurant", {
      request_id: requestId,
      payment_id: event.payment_id,
      restaurant_id: event.restaurant_id,
    });
    return { outcome: "unknown_restaurant" };
  }

  // O PSP reentrega o mesmo evento quando nao recebe 2xx dentro do timeout.
  // Se ja registramos essa transicao de status, nao ha nada a fazer.
  const alreadyProcessed = await client.query(
    "SELECT id FROM payments WHERE payment_id = $1 AND status = $2",
    [event.payment_id, event.status]
  );

  logger.info("payment.dedup_check", {
    request_id: requestId,
    payment_id: event.payment_id,
    status: event.status,
    rows_found: alreadyProcessed.rowCount ?? 0,
  });

  if ((alreadyProcessed.rowCount ?? 0) > 0) {
    return { outcome: "duplicate" };
  }

  const inserted = await client.query(
    `INSERT INTO payments (payment_id, restaurant_id, amount, status)
          VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [event.payment_id, event.restaurant_id, event.amount, event.status]
  );

  logger.info("payment.recorded", {
    request_id: requestId,
    payment_id: event.payment_id,
    status: event.status,
    rows_inserted: inserted.rowCount ?? 0,
  });

  if (event.status !== "confirmed") {
    return { outcome: "recorded", status: event.status };
  }

  const current = await client.query(
    "SELECT balance FROM balances WHERE restaurant_id = $1",
    [event.restaurant_id]
  );

  const balanceBefore = Number(current.rows[0].balance);
  const newBalance = toMoney(balanceBefore + event.amount);

  await client.query(
    "UPDATE balances SET balance = $1, updated_at = now() WHERE restaurant_id = $2",
    [newBalance, event.restaurant_id]
  );

  logger.info("balance.credited", {
    request_id: requestId,
    payment_id: event.payment_id,
    restaurant_id: event.restaurant_id,
    amount: logMoney(event.amount),
    balance_before: logMoney(balanceBefore),
    balance_after: logMoney(newBalance),
  });

  return { outcome: "credited", balance: newBalance };
}
