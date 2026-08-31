import "dotenv/config";
import express from "express";
import { loadMenu } from "./menu";
import { createLLM } from "./llm";
import { handleConversation } from "./handleConversation";

const app = express();
app.use(express.json());

const menu = loadMenu();
// Real precisa de OPENAI_API_KEY; sem chave cai no mock (o server sobe do mesmo jeito).
const llm = createLLM({ mock: !process.env.OPENAI_API_KEY });

app.get("/", (_req, res) => {
  res.json({ ok: true });
});

app.post("/orders", async (req, res) => {
  try {
    const { messages = [], customer } = req.body ?? {};
    const result = await handleConversation({ storeId: menu.storeId, messages, customer }, menu, llm);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "erro" });
  }
});

const PORT = Number(process.env.PORT || 5052);
app.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`));
