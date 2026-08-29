// ============================================================================
// Precision runner — FORNECIDO. Mede a precisão do seu pipeline nos casos reais,
// do mesmo jeito que os testes de precisão da Brenda: roda a conversa e compara
// o Checkout produzido com o `expectedCheckout` via compareCheckout (esparso).
//
//   npm run precision            -> LLM de verdade (precisa de OPENAI_API_KEY)
//   npm run precision -- --mock  -> mock offline (só pra ver o harness de pé)
//
// É uma NOTA, não pass/fail binário. O objetivo é maximizar a precisão.
// ============================================================================

import { loadMenu } from "../../src/menu";
import { createLLM } from "../../src/llm";
import { handleConversation } from "../../src/handleConversation";
import { compareCheckout } from "../../src/compareCheckout";
import type { Checkout, Conversation } from "../../src/types";
import cases from "./cases.json";

type Case = {
  useCase: string;
  messages: Conversation["messages"];
  expectedCheckout?: Checkout;
  expectClarification?: boolean;
};

async function main() {
  const menu = loadMenu();
  const llm = createLLM({ mock: process.argv.includes("--mock") });
  const all = cases as Case[];

  let pass = 0;
  console.log(`\n  Precisão — ${menu.storeName} (${all.length} casos)\n`);

  for (const c of all) {
    let ok = false;
    let info = "";
    try {
      const res = await handleConversation({ storeId: menu.storeId, messages: c.messages }, menu, llm);
      if (c.expectClarification) {
        ok = !res.ok && !!res.clarification;
        info = res.ok ? `montou (esperava clarificação)` : `clarificou`;
      } else if (res.ok) {
        const cmp = compareCheckout(c.expectedCheckout ?? { products: [] }, res.checkout);
        ok = cmp.passed;
        info = ok ? `total ${res.checkout.totalPrice}` : cmp.details.filter((d) => d.status === "fail").map((d) => `${d.path}: ${d.message}`).join(" | ");
      } else {
        info = `recusou: ${res.clarification ?? res.reason}`;
      }
    } catch (e: any) {
      info = `erro: ${e.message}`;
    }
    if (ok) pass++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${c.useCase.padEnd(30)} ${info}`);
  }

  const pct = ((pass / all.length) * 100).toFixed(0);
  console.log(`\n  Precisão: ${pass}/${all.length} (${pct}%)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
