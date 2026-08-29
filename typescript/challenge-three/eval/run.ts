// ============================================================================
// Eval harness — FORNECIDO. Mede a "precisão" do seu pipeline nos casos reais.
//
//   npm run eval          -> roda com a LLM de verdade (precisa de OPENAI_API_KEY)
//   npm run eval -- --mock -> roda com o mock (só pra ver o harness de pé)
//
// Não é pass/fail binário como os testes: é uma NOTA. LLM é probabilística, o
// objetivo é maximizar a precisão, não cravar 100% num único run.
// ============================================================================

import { loadMenu } from "../src/menu";
import { createLLM } from "../src/llm";
import { handleConversation } from "../src/orderAssembler";
import type { Conversation } from "../src/types";
import cases from "./cases.json";

type ExpectItem = { productId: string; quantity: number };
type Case = {
  name: string;
  messages: Conversation["messages"];
  expect: { items?: ExpectItem[]; totalCents?: number; clarification?: boolean };
};

function scoreCase(exp: Case["expect"], result: any): boolean {
  if (exp.clarification) return result.ok === false && !!result.clarification;
  if (!result.ok) return false;
  const items = result.order.items as { productId: string; quantity: number }[];
  const want = exp.items ?? [];
  const itemsOk =
    items.length === want.length &&
    want.every((w) => items.some((i) => i.productId === w.productId && i.quantity === w.quantity));
  const totalOk = exp.totalCents === undefined || result.order.totalCents === exp.totalCents;
  return itemsOk && totalOk;
}

async function main() {
  const menu = loadMenu();
  const llm = createLLM({ mock: process.argv.includes("--mock") });
  const all = cases as Case[];

  let pass = 0;
  console.log(`\n  Eval — ${menu.storeName} (${all.length} casos)\n`);
  for (const c of all) {
    let ok = false;
    let detail = "";
    try {
      const result = await handleConversation({ storeId: menu.storeId, messages: c.messages }, menu, llm);
      ok = scoreCase(c.expect, result);
      detail = result.ok ? `total ${result.order.totalCents}` : `clarify: ${result.clarification ?? result.reason}`;
    } catch (e: any) {
      detail = `erro: ${e.message}`;
    }
    if (ok) pass++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(28)} ${detail}`);
  }
  const pct = ((pass / all.length) * 100).toFixed(0);
  console.log(`\n  Precisão: ${pass}/${all.length} (${pct}%)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
