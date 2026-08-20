import express from "express";
import { randomUUID } from "crypto";
import { pool } from "./db";
import { logger } from "./logger";
import { parsePaymentEvent } from "./payments/types";
import { processPaymentEvent } from "./payments/payment-service";
import { findBalance } from "./restaurants/balance-repository";

const app = express();
app.use(express.json());

// Correlation id por request, para conseguir amarrar as linhas de log de uma
// mesma entrega quando varias estao em voo ao mesmo tempo.
app.use((_req, res, next) => {
  res.locals.requestId = randomUUID().slice(0, 8);
  next();
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ status: "unavailable" });
  }
});

// Webhook de pagamento do PSP.
//
// O PSP espera 2xx para considerar o evento entregue; qualquer outra coisa
// entra na fila de reentrega dele.
app.post("/webhooks/payment", async (req, res) => {
  const requestId: string = res.locals.requestId;
  const startedAt = Date.now();
  const parsed = parsePaymentEvent(req.body);

  if ("errors" in parsed) {
    logger.warn("webhook.rejected", {
      request_id: requestId,
      reason: parsed.errors.join("; "),
    });
    return res.status(400).json({ error: "invalid_payload", details: parsed.errors });
  }

  logger.info("webhook.received", {
    request_id: requestId,
    payment_id: parsed.event.payment_id,
    restaurant_id: parsed.event.restaurant_id,
    amount: parsed.event.amount.toFixed(2),
    status: parsed.event.status,
  });

  try {
    const result = await processPaymentEvent(parsed.event, requestId);

    if (result.outcome === "unknown_restaurant") {
      logger.info("webhook.completed", {
        request_id: requestId,
        payment_id: parsed.event.payment_id,
        outcome: result.outcome,
        http_status: 404,
        duration_ms: Date.now() - startedAt,
      });
      return res.status(404).json({ error: "unknown_restaurant" });
    }

    logger.info("webhook.completed", {
      request_id: requestId,
      payment_id: parsed.event.payment_id,
      outcome: result.outcome,
      http_status: 200,
      duration_ms: Date.now() - startedAt,
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error("webhook.failed", {
      request_id: requestId,
      payment_id: parsed.event.payment_id,
      duration_ms: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ error: "internal_error" });
  }
});

// Saldo consolidado do restaurante — usado pelo app do parceiro.
app.get("/restaurants/:id/balance", async (req, res) => {
  const requestId: string = res.locals.requestId;

  try {
    const balance = await findBalance(req.params.id);

    if (!balance) {
      return res.status(404).json({ error: "unknown_restaurant" });
    }

    return res.json(balance);
  } catch (err) {
    logger.error("balance.query_failed", {
      request_id: requestId,
      restaurant_id: req.params.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ error: "internal_error" });
  }
});

const PORT = Number(process.env.PORT ?? 5070);

const server = app.listen(PORT, () => {
  logger.info("server.started", {
    port: PORT,
    pg_pool_max: Number(process.env.PG_POOL_MAX ?? 10),
  });
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    logger.info("server.stopping", { signal });
    server.close(() => {
      pool.end().then(() => process.exit(0));
    });
  });
}
