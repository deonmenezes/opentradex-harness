import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIMessage, ChatOptions, AIResponse } from './types.js';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-sonnet-4-6';
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  async chat(messages: AIMessage[], options: ChatOptions = {}): Promise<AIResponse> {
    const system = options.systemPrompt
      ?? messages.find((m) => m.role === 'system')?.content;
    const convo = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const res = await this.getClient().messages.create({
      model: options.model || this.defaultModel,
      max_tokens: options.maxTokens ?? 2048,
      system,
      messages: convo.length > 0 ? convo : [{ role: 'user', content: '' }],
    });

    const text = res.content.find((c) => c.type === 'text');
    return {
      content: text?.type === 'text' ? text.text : '',
      model: res.model,
      provider: this.name,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
    };
  }
}
