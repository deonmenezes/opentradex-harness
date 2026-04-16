/**
 * Provider abstraction for multi-model AI access.
 * Inspired by oh-my-openagent — no single-model lock-in.
 */

export type AIRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export type TaskRole = 'orchestrator' | 'reasoning' | 'speed' | 'creative';

export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;
  isConfigured(): boolean;
  chat(messages: AIMessage[], options?: ChatOptions): Promise<AIResponse>;
}
