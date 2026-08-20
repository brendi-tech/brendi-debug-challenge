import { closePool, withClient } from "../src/db";
import { resetLedger } from "./reset-ledger";

const TARGET_URL = process.env.TARGET_URL ?? "http://localhost:5070";

/** Quantas levas de eventos o PSP despeja ao esvaziar a fila dele. */
const WAVES = Number(process.env.WAVES ?? 4);

/** Quantos restaurantes entram em cada leva. */
const WAVE_SIZE = Number(process.env.WAVE_SIZE ?? 32);

/** Quantas vezes o PSP entregou um evento que ficou sem 2xx dentro do timeout. */
const DELIVERIES = Number(process.env.DELIVERIES ?? 2);

/** Quantos eventos da leva entram entre uma reentrega e a entrega anterior. */
const RETRY_GAP = Number(process.env.RETRY_GAP ?? 6);

/**
 * Eventos que ficaram sem 2xx dentro do timeout do PSP e foram entregues de
 * novo, identificados pela leva e pela posicao dentro dela.
 */
const REDELIVERED = [
  { wave: 0, slot: 6 },
  { wave: 1, slot: 21 },
  { wave: 2, slot: 13 },
];

interface WebhookEvent {
  payment_id: string;
  restaurant_id: string;
  amount: number;
  status: "confirmed";
}

function paymentId(wave: number, slot: number): string {
  return `pay_2026w34_${wave}${String(slot).padStart(3, "0")}`;
}

/** Valores variados, na faixa de um ticket medio de delivery. */
function amountFor(wave: number, slot: number): number {
  return Math.round((38.4 + slot * 3.17 + wave * 11.9) * 100) / 100;
}

async function listRestaurants(limit: number): Promise<string[]> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM restaurants ORDER BY id LIMIT $1",
      [limit]
    );
    return rows.map((r) => r.id);
  });
}

/**
 * Monta uma leva da fila do PSP: um pagamento confirmado por restaurante, mais
 * as reentregas que caem nessa leva.
 *
 * A reentrega nao vem encostada no evento original: ela volta para o fim da
 * fila do PSP e chega depois dos eventos que entraram nesse meio tempo.
 */
function buildWave(wave: number, restaurants: string[]): WebhookEvent[] {
  const events: WebhookEvent[] = restaurants.map((restaurantId, slot) => ({
    payment_id: paymentId(wave, slot),
    restaurant_id: restaurantId,
    amount: amountFor(wave, slot),
    status: "confirmed",
  }));

  for (const retry of REDELIVERED) {
    if (retry.wave !== wave || retry.slot >= events.length) {
      continue;
    }

    const original = events[retry.slot];
    for (let d = 1; d < DELIVERIES; d++) {
      events.splice(retry.slot + d * RETRY_GAP, 0, original);
    }
  }

  return events;
}

async function deliver(event: WebhookEvent): Promise<string> {
  const response = await fetch(`${TARGET_URL}/webhooks/payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    return `HTTP ${response.status}`;
  }

  const body = (await response.json()) as { outcome?: string };
  return body.outcome ?? "unknown";
}

/**
 * Reproduz uma janela de entrega do PSP.
 *
 * O PSP acumula eventos quando a nossa integracao fica indisponivel e depois
 * despeja a fila em levas. Cada restaurante recebe um pagamento por leva, entao
 * ao fim da janela o saldo dele e a soma dos pagamentos de todas as levas.
 */
async function main(): Promise<void> {
  await resetLedger();

  const restaurants = await listRestaurants(WAVE_SIZE);
  const tally: Record<string, number> = {};
  let delivered = 0;
  let distinct = 0;

  console.log(`POST ${TARGET_URL}/webhooks/payment`);
  console.log(`Janela do PSP: ${WAVES} levas de ${restaurants.length} restaurantes\n`);

  for (let wave = 0; wave < WAVES; wave++) {
    const events = buildWave(wave, restaurants);
    const outcomes = await Promise.all(events.map(deliver));

    for (const outcome of outcomes) {
      tally[outcome] = (tally[outcome] ?? 0) + 1;
    }

    delivered += events.length;
    distinct += new Set(events.map((e) => e.payment_id)).size;
  }

  for (const [outcome, count] of Object.entries(tally).sort()) {
    console.log(`  ${outcome.padEnd(20)} ${String(count).padStart(4)}`);
  }

  console.log(
    `\n${delivered} entregas concluidas, referentes a ${distinct} pagamentos confirmados.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closePool);
