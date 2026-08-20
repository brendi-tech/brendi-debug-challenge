import { closePool, withClient } from "../src/db";

/**
 * Volta o ledger para o estado inicial: nenhum pagamento registrado e todos os
 * saldos zerados. Usado antes de simular uma janela de entrega do PSP.
 */
export async function resetLedger(): Promise<void> {
  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("TRUNCATE payments");
      await client.query("UPDATE balances SET balance = 0, updated_at = now()");
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}

if (require.main === module) {
  resetLedger()
    .then(() => console.log("Ledger zerado: pagamentos apagados e saldos em 0."))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(closePool);
}
