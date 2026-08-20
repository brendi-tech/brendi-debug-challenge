type LogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * Logger em logfmt: uma linha por evento, `chave=valor`.
 *
 * Formato escolhido para ser legivel no terminal e facil de filtrar com grep:
 *
 *   2026-08-20T12:41:54.476Z info  balance.credited payment_id=pay_x ...
 */
function emit(level: "info" | "warn" | "error", event: string, fields: LogFields): void {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");

  const line = `${new Date().toISOString()} ${level.padEnd(5)} ${event}${pairs ? " " + pairs : ""}`;

  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (event: string, fields: LogFields = {}) => emit("info", event, fields),
  warn: (event: string, fields: LogFields = {}) => emit("warn", event, fields),
  error: (event: string, fields: LogFields = {}) => emit("error", event, fields),
};

/** Formata dinheiro para log, sempre com duas casas. */
export function logMoney(value: number): string {
  return value.toFixed(2);
}
