import "dotenv/config";
import express from "express";
import { loadMenu } from "./menu";
import { createLLM } from "./llm";
import type { LLM } from "./llm";
import { handleConversation } from "./handleConversation";
import type { Message } from "./types";

const app = express();
app.use(express.json());

const menu = loadMenu();
// Precisa de OPENAI_API_KEY. Sem ela o server sobe (GET /), mas /orders responde
// um erro claro — nada de fallback silencioso pra um mock.
const llm: LLM | null = process.env.OPENAI_API_KEY ? createLLM() : null;

app.get("/", (_req, res) => {
  res.json({ ok: true });
});

app.post("/orders", async (req, res) => {
  if (!llm) {
    return res.status(503).json({ error: "OPENAI_API_KEY ausente — copie .env.example para .env e configure a chave." });
  }
  try {
    const { messages = [] } = req.body ?? {};
    const result = await handleConversation({ storeId: menu.storeId, messages }, menu, llm);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "erro" });
  }
});

const PORT = Number(process.env.PORT || 5052);
app.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`));
