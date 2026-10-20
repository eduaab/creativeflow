import { env } from '../../config/env';
import { isLlmConfigured, llmProvider } from './llm';
import { mockProvider } from './mock';
import type { AIProvider } from './types';

export * from './types';

export interface AIOutcome<T> {
  result: T;
  provider: string;
  /** true quando o provedor real falhou e o modo demonstração respondeu. */
  fallback: boolean;
  error?: string;
  ms: number;
}

export function aiStatus() {
  const configured = env.aiProvider !== 'mock' && isLlmConfigured();
  return {
    provider: configured ? env.aiProvider : 'mock',
    mode: configured ? 'ia-generativa' : 'demonstracao',
    requested: env.aiProvider,
  };
}

function primary(): AIProvider {
  return aiStatus().provider === 'mock' ? mockProvider : llmProvider;
}

export async function runAI<T>(fn: (p: AIProvider) => Promise<T>): Promise<AIOutcome<T>> {
  const p = primary();
  const t0 = Date.now();
  try {
    return { result: await fn(p), provider: p.name, fallback: false, ms: Date.now() - t0 };
  } catch (err) {
    if (p === mockProvider) throw err;
    const result = await fn(mockProvider);
    return { result, provider: 'mock', fallback: true, error: String(err).slice(0, 400), ms: Date.now() - t0 };
  }
}
