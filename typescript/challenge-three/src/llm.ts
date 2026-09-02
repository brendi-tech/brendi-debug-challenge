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
      throw new Error("OPENAI_API_KEY ausente. Peça a chave ao entrevistador e copie .env.example para .env.");
    }
    this.client = new OpenAI({ apiKey });
    this.model = process.env.BRENDA_MODEL || "gpt-4o-mini";
  }
  async chat(opts: ChatOptions): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: opts.temperature ?? 0,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(opts.jsonSchemaHint ? { response_format: { type: "json_object" } } : {}),
    });
    return res.choices[0]?.message?.content ?? "";
  }
}

export function createLLM(): LLM {
  return new OpenAILLM();
}

// LLM de teste: ignora o prompt e sempre devolve `output`. É o que o `npm test`
// usa pra ser determinístico (sem chave, sem server).
export function makeFakeLLM(output: unknown): LLM {
  const s = typeof output === "string" ? output : JSON.stringify(output);
  return { chat: async () => s };
}
