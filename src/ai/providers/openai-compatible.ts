import type { AIProvider, AIMessage, ChatOptions, AIResponse } from './types.js';

/**
 * OpenAI-compatible provider — one class, many backends.
 * Covers: OpenAI, OpenRouter, Kimi/Moonshot, GLM/Zhipu, Groq, DeepSeek, Together, xAI/Grok, Perplexity, ...
 */
export class OpenAICompatibleProvider implements AIProvider {
  constructor(
    public readonly name: string,
    public readonly baseUrl: string,
    public readonly envKey: string,
    public readonly defaultModel: string,
    private readonly extraHeaders: Record<string, string> = {},
  ) {}

  isConfigured(): boolean {
    return !!process.env[this.envKey];
  }

  async chat(messages: AIMessage[], options: ChatOptions = {}): Promise<AIResponse> {
    const apiKey = process.env[this.envKey];
    if (!apiKey) throw new Error(`${this.name}: ${this.envKey} not set`);

    const payload: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      max_tokens: options.maxTokens ?? 2048,
      messages: options.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages.filter((m) => m.role !== 'system')]
        : messages,
    };
    if (options.temperature !== undefined) payload.temperature = options.temperature;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...this.extraHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`${this.name} ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as {
      model?: string;
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model || payload.model as string,
      provider: this.name,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      } : undefined,
    };
  }
}
