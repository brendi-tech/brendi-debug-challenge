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
  expectEscalation?: boolean;
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

  let pass = 0, fail = 0;
  const ok = (label: string, cond: boolean, info = "") => {
    console.log(`  ${cond ? G + "PASS" : R + "FAIL"}${X}  ${label.padEnd(34)} ${info}`);
    cond ? pass++ : fail++;
  };

  console.log(`\n${B}Endpoints${X}`);
  ok("GET /", up.status === 200 && up.data?.ok === true);
  const notify = await request("POST", "/owner/notify", { storeId: "x", reason: "teste", messages: [] });
  ok("POST /owner/notify", notify.status === 200 && notify.data?.received === true);

  console.log(`\n${B}POST /orders — ${(cases as Case[]).length} casos${X}`);
  let hit = 0;
  for (const c of cases as Case[]) {
    const { status, data, error } = await request("POST", "/orders", { messages: c.messages });
    let good = false, info = "";
    if (error || status !== 200) {
      info = error ?? `HTTP ${status}`;
    } else if (c.expectEscalation) {
      good = data?.ok === false && data?.escalated === true;
      info = good ? "escalou" : `esperava escalar, veio ${JSON.stringify(data)}`;
    } else if (c.expectClarification) {
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
    ok(c.useCase, good, info);
  }

  const total = pass + fail;
  console.log(`\n${B}${pass}/${total} checks · precisão /orders ${hit}/${(cases as Case[]).length}${X}\n`);
  if (fail > 0) process.exit(1);
}

main();
