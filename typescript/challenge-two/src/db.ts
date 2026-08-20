import { Pool, PoolClient } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://brendi:brendi@localhost:5433/brendi_payments";

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 10),
});

/** Pega uma conexao do pool, roda `fn` e devolve a conexao. */
export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
