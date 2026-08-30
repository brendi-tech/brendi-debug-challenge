import { logLLM } from "./lib/observability";

export type ChatOptions = {
  system: string;
  user: string;
  jsonSchemaHint?: string;
  temperature?: number;
};

export interface LLM {
  chat(opts: ChatOptions): Promise<string>;
}

class OpenAILLM implements LLM {
  private client: any;
  private model: string;
  constructor() {
    const OpenAI = require("openai").default ?? require("openai");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY ausente. Peça a chave ao entrevistador, copie .env.example para .env, ou use createLLM({ mock: true })."
      );
    }
    this.client = new OpenAI({ apiKey });
    this.model = process.env.BRENDA_MODEL || "gpt-4o-mini";
  }
  async chat(opts: ChatOptions): Promise<string> {
    const t0 = Date.now();
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: opts.temperature ?? 0,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(opts.jsonSchemaHint ? { response_format: { type: "json_object" } } : {}),
    });
    const u = res.usage ?? {};
    logLLM("llm", {
      model: this.model,
      prompt_tokens: u.prompt_tokens,
      completion_tokens: u.completion_tokens,
      total_tokens: u.total_tokens,
      ms: Date.now() - t0,
    });
    return res.choices[0]?.message?.content ?? "";
  }
}

class MockLLM implements LLM {
  async chat(opts: ChatOptions): Promise<string> {
    const t = opts.user.toLowerCase();
    const products: any[] = [];
    if (t.includes("x-tudo") || t.includes("x tudo")) products.push({ productId: "x-tudo", quantity: 1 });
    if (t.includes("x-salada") || t.includes("x salada")) products.push({ productId: "x-salada", quantity: 1 });
    if (products.length === 0) products.push({ productId: "x-salada", quantity: 1 });
    return JSON.stringify({ products });
  }
}

export function createLLM(opts?: { mock?: boolean }): LLM {
  return opts?.mock ? new MockLLM() : new OpenAILLM();
}

// LLM de teste: ignora o prompt e sempre devolve `output`.
export function makeFakeLLM(output: unknown): LLM {
  const s = typeof output === "string" ? output : JSON.stringify(output);
  return { chat: async () => s };
}
