import type { AIProvider, AIMessage, ChatOptions, AIResponse } from './types.js';

/**
 * Google Gemini provider (REST API, no SDK dependency).
 */
export class GoogleProvider implements AIProvider {
  readonly name = 'gemini';
  readonly defaultModel = 'gemini-2.0-flash';
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  isConfigured(): boolean {
    return !!process.env.GOOGLE_API_KEY || !!process.env.GEMINI_API_KEY;
  }

  async chat(messages: AIMessage[], options: ChatOptions = {}): Promise<AIResponse> {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('gemini: GOOGLE_API_KEY or GEMINI_API_KEY not set');

    const model = options.model || this.defaultModel;
    const systemText = options.systemPrompt
      ?? messages.find((m) => m.role === 'system')?.content;

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const payload: Record<string, unknown> = {
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: '' }] }],
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 2048,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      },
    };
    if (systemText) {
      payload.systemInstruction = { parts: [{ text: systemText }] };
    }

    const url = `${this.baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`gemini ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

    return {
      content: text,
      model,
      provider: this.name,
      usage: data.usageMetadata ? {
        inputTokens: data.usageMetadata.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
      } : undefined,
    };
  }
}
