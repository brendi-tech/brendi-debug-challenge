import express from "express";
import { loadMenu } from "./menu";
import { createLLM } from "./llm";
import { handleConversation } from "./handleConversation";
import type { Message } from "./types";

const app = express();
app.use(express.json());

const menu = loadMenu();
// Real precisa de OPENAI_API_KEY; sem chave cai no mock (o server sobe do mesmo jeito).
const llm = createLLM({ mock: !process.env.OPENAI_API_KEY });

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/orders", async (req, res) => {
  try {
    const messages = (req.body?.messages ?? []) as Message[];
    const result = await handleConversation({ storeId: menu.storeId, messages }, menu, llm);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "erro" });
  }
});

const PORT = Number(process.env.PORT || 5052);
app.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`));
