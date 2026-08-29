// Sink de observabilidade das chamadas de LLM. Cada evento vai pra stderr (visão
// ao vivo, sem sujar o stdout do pedido) E é appendado num arquivo JSONL separado,
// pra dar pra investigar uma call específica depois.

import { appendFileSync } from "fs";

const FILE = process.env.LLM_LOG_FILE || "llm-calls.jsonl";

export function logLLM(tag: string, record: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), tag, ...record });
  console.error(`[${tag}] ${line}`);
  // I/O do log nunca pode derrubar o pedido — falha é engolida de propósito
  try {
    appendFileSync(FILE, line + "\n");
  } catch {}
}
