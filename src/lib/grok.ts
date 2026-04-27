const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = "grok-4-1-fast-reasoning";

export interface GrokMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GrokOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export class GrokError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = "GrokError";
    this.status = status;
    this.body = body;
  }
}

export async function callGrok(
  messages: GrokMessage[],
  options: GrokOptions = {}
): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    throw new GrokError("GROK_API_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    model: GROK_MODEL,
    messages,
    temperature: options.temperature ?? 0.4,
  };
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(GROK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status >= 500 || res.status === 429) {
          lastErr = new GrokError(`Grok API ${res.status}`, res.status, text);
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        clearTimeout(timeout);
        throw new GrokError(`Grok API error ${res.status}: ${text}`, res.status, text);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      clearTimeout(timeout);
      const content = json.choices?.[0]?.message?.content ?? "";
      return content;
    } catch (err) {
      lastErr = err;
      if (attempt === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  clearTimeout(timeout);
  if (lastErr instanceof Error) throw lastErr;
  throw new GrokError("Grok API failed after retries");
}

export function extractJson<T = unknown>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Failed to find JSON object in model output: ${text.slice(0, 200)}`);
  }
  const slice = candidate.slice(start, end + 1);
  return JSON.parse(slice) as T;
}
