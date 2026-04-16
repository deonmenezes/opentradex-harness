import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AIProvider, AIMessage, ChatOptions, AIResponse } from './types.js';

function detectClaudeCLI(): string | null {
  const candidates = process.platform === 'win32'
    ? ['claude.cmd', 'claude.exe', 'claude']
    : ['claude'];
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

/**
 * Zero-config provider: uses the locally-installed Claude Code CLI and its auth
 * (subscription or API key). Works without setting any env vars.
 */
export class ClaudeCLIProvider implements AIProvider {
  readonly name = 'claude-cli';
  readonly defaultModel = 'default';
  private cachedPath: string | null | undefined;

  isConfigured(): boolean {
    if (this.cachedPath === undefined) this.cachedPath = detectClaudeCLI();
    return this.cachedPath !== null;
  }

  async chat(messages: AIMessage[], options: ChatOptions = {}): Promise<AIResponse> {
    if (!this.isConfigured() || !this.cachedPath) {
      throw new Error('claude-cli: binary not found on PATH');
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

    const args = ['-p'];
    if (options.model) args.push('--model', options.model);

    const content = await new Promise<string>((resolve, reject) => {
      const child = spawn(this.cachedPath!, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (c) => { stdout += c.toString(); });
      child.stderr?.on('data', (c) => { stderr += c.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(`claude CLI exited ${code}: ${stderr || stdout}`));
      });
      child.stdin?.write(prompt);
      child.stdin?.end();
    });

    return { content, model: options.model || this.defaultModel, provider: this.name };
  }
}
