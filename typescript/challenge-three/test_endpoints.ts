// NÃO MEXER — harness que valida sua API (rode com o server no ar). Edite e você
// está trapaceando no próprio teste.
//
// Sobe o server (npm start) e roda ISSO (npm run test:api). Bate nos endpoints por
// HTTP, igual a gente valida a Brenda de verdade:
//   GET  /                (server no ar)
//   POST /owner/notify    (o endpoint que recebe a escalação)
//   POST /orders          (monta o pedido a partir da conversa)
// A precisão de /orders é uma NOTA (LLM real); o resto é pass/fail.

import "dotenv/config";
import http from "http";
import { compareCheckout } from "./src/compareCheckout";
import type { Checkout, Message } from "./src/types";
import cases from "./cases.json";

const BASE = process.env.BASE_URL || "http://localhost:5052";
const G = "\x1b[92m", R = "\x1b[91m", B = "\x1b[1m", X = "\x1b[0m";

type Case = {
  useCase: string;
  messages: Message[];
  expectedCheckout?: Checkout;
  expectClarification?: boolean;
};

function request(method: string, path: string, body?: unknown): Promise<{ status: number | null; data: any; error: string | null }> {
  return new Promise((resolve) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      `${BASE}${path}`,
      { method, headers: { "content-type": "application/json" } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? null, data: raw ? JSON.parse(raw) : null, error: null });
          } catch {
            resolve({ status: res.statusCode ?? null, data: null, error: `resposta não-JSON: ${raw.slice(0, 200)}` });
          }
        });
      }
    );
    req.on("error", (e) => resolve({ status: null, data: null, error: `servidor inacessível: ${e.message}` }));
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const up = await request("GET", "/");
  if (up.error) {
    console.log(`${R}Servidor inacessível em ${BASE}. Rode 'npm start' antes.${X}\n${up.error}`);
    process.exit(1);
  }

  // Só coisa QUEBRADA derruba o processo (endpoint fora, /orders com erro/500).
  // Precisão é NOTA — miss não falha o processo (a LLM não é determinística).
  let hardFail = false;

  console.log(`\n${B}Endpoint${X}`);
  const upOk = up.status === 200 && up.data?.ok === true;
  console.log(`  ${upOk ? G + "PASS" : R + "FAIL"}${X}  GET /`);
  if (!upOk) hardFail = true;

  console.log(`\n${B}POST /orders — ${(cases as Case[]).length} casos (precisão = nota)${X}`);
  let hit = 0;
  for (const c of cases as Case[]) {
    const { status, data, error } = await request("POST", "/orders", { messages: c.messages });
    if (error || status !== 200) {
      console.log(`  ${R}ERRO${X}  ${c.useCase.padEnd(38)} ${error ?? `HTTP ${status}`}`);
      hardFail = true;
      continue;
    }
    let good = false, info = "";
    if (c.expectClarification) {
      good = data?.ok === false && !!data?.clarification;
      info = good ? "clarificou" : `esperava clarificação, veio ${JSON.stringify(data)}`;
    } else if (data?.ok) {
      const cmp = compareCheckout(c.expectedCheckout ?? { products: [] }, data.checkout);
      good = cmp.passed;
      info = good ? `total ${data.checkout.totalPrice}` : cmp.details.filter((d) => d.status === "fail").map((d) => d.path).join(", ");
    } else {
      info = `recusou: ${data?.clarification ?? data?.reason}`;
    }
    if (good) hit++;
    console.log(`  ${good ? G + "ok  " : R + "miss"}${X}  ${c.useCase.padEnd(38)} ${info}`);
  }

  const n = (cases as Case[]).length;
  console.log(`\n${B}precisão /orders ${hit}/${n}${X}${hardFail ? `  ${R}(endpoint/erro falhou)${X}` : ""}\n`);
  if (hardFail) process.exit(1);
}

main();
