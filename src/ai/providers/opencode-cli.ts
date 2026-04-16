import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AIProvider, AIMessage, ChatOptions, AIResponse } from './types.js';

function detectOpenCodeCLI(): string | null {
  const candidates = process.platform === 'win32'
    ? ['opencode.cmd', 'opencode.exe', 'opencode']
    : ['opencode'];
  const pathDirs = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':');
  for (const dir of pathDirs) {
    if (!dir) continue;
    for (const name of candidates) {
      const full = join(dir, name);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

function escapeForCmd(arg: string): string {
  // cmd.exe-safe: wrap in quotes, escape internal quotes as "",
  // neutralize env-var expansion and newlines.
  const flat = arg
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/%/g, '')
    .replace(/!/g, '');
  return `"${flat.replace(/"/g, '""')}"`;
}

/**
 * Zero-config provider: uses the locally-installed OpenCode CLI (sst/opencode)
 * and its built-in auth (`opencode providers`). Mirrors oh-my-openagent's harness
 * idea — orchestrate whatever model the user has configured inside OpenCode.
 *
 * Default model is `opencode/gpt-5-nano` which is free and requires no login.
 * Override per-call via ChatOptions.model in the `provider/model` form.
 */
export class OpenCodeCLIProvider implements AIProvider {
  readonly name = 'opencode-cli';
  readonly defaultModel = 'opencode/gpt-5-nano';
  private cachedPath: string | null | undefined;

  isConfigured(): boolean {
    if (this.cachedPath === undefined) this.cachedPath = detectOpenCodeCLI();
    return this.cachedPath !== null;
  }

  async chat(messages: AIMessage[], options: ChatOptions = {}): Promise<AIResponse> {
    if (!this.isConfigured() || !this.cachedPath) {
      throw new Error('opencode-cli: binary not found on PATH');
    }

    const parts: string[] = [];
    const systemText = options.systemPrompt
      ?? messages.find((m) => m.role === 'system')?.content;
    if (systemText) parts.push(systemText, '---');
    for (const m of messages) {
      if (m.role === 'system') continue;
      parts.push(m.role === 'user' ? m.content : `[assistant]: ${m.content}`);
    }
    const prompt = parts.join('\n\n');

    const model = options.model || this.defaultModel;
    const isWin = process.platform === 'win32';

    const baseArgs = ['run', '--format', 'json', '-m', model];
    const promptArg = isWin ? escapeForCmd(prompt) : prompt;
    const args = [...baseArgs, promptArg];

    const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(this.cachedPath!, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWin,
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (c) => { stdout += c.toString(); });
      child.stderr?.on('data', (c) => { stderr += c.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`opencode CLI exited ${code}: ${stderr.slice(0, 500) || stdout.slice(0, 500)}`));
      });
    });

    const texts: string[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let sawError: string | null = null;

    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;
      try {
        const evt = JSON.parse(trimmed) as {
          type?: string;
          part?: { type?: string; text?: string; tokens?: { input?: number; output?: number } };
          error?: { data?: { message?: string } };
        };
        if (evt.type === 'text' && evt.part?.text) texts.push(evt.part.text);
        if (evt.type === 'step_finish' && evt.part?.tokens) {
          inputTokens += evt.part.tokens.input ?? 0;
          outputTokens += evt.part.tokens.output ?? 0;
        }
        if (evt.type === 'error' && evt.error?.data?.message) sawError = evt.error.data.message;
      } catch {
        // Ignore non-JSON lines (banner / progress output)
      }
    }

    if (texts.length === 0 && sawError) {
      throw new Error(`opencode-cli: ${sawError}`);
    }

    return {
      content: texts.join(''),
      model,
      provider: this.name,
      usage: inputTokens || outputTokens ? { inputTokens, outputTokens } : undefined,
    };
  }
}
