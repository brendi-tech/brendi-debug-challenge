// Aciona o dono do restaurante quando nao e pra Brenda resolver. E so uma
// chamada HTTP pra um webhook (mock em mock/owner-endpoint.ts). A falha da call
// NUNCA pode derrubar o atendimento — a gente loga e segue.

import type { Conversation } from "../types";
import { logLLM } from "./observability";

const URL = process.env.OWNER_WEBHOOK_URL || "http://localhost:4000/owner/notify";

export type OwnerNotice = {
  storeId: string;
  reason: string;
  messages: Conversation["messages"];
};

export async function notifyOwner(notice: OwnerNotice): Promise<boolean> {
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...notice, at: new Date().toISOString() }),
    });
    logLLM("escalation", { url: URL, status: res.status, reason: notice.reason });
    return res.ok;
  } catch (e) {
    logLLM("escalation", { url: URL, error: String(e), reason: notice.reason });
    return false;
  }
}
