import { ConceptSchema } from '@cf/shared';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { env } from '../../config/env';
import { conceptSystemPrompt, conceptUserPrompt, critiqueSystemPrompt, editSystemPrompt, editUserPrompt } from './prompts';
import { CritiqueSchema, EditResultSchema, type AIProvider } from './types';

/**
 * Provedores reais via HTTP (sem SDK, para manter a troca simples):
 *  - openai        → api.openai.com (ou compatível via OPENAI_BASE_URL)
 *  - azure-openai  → Azure OpenAI (deployment próprio, dados na região escolhida)
 *  - anthropic     → Claude (Messages API, saída por tool use)
 * Toda saída é validada com Zod no servidor; se falhar, o chamador cai no mock e registra.
 */

type Part = { type: 'text'; text: string } | { type: 'image'; base64: string; mime: string };

interface JsonCall<T> {
  name: string;
  system: string;
  user: Part[];
  schema: z.ZodType<T>;
  maxTokens?: number;
}

function jsonSchemaOf(schema: z.ZodTypeAny): Record<string, unknown> {
  const js = zodToJsonSchema(schema, { $refStrategy: 'none' }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

async function callOpenAICompatible<T>(c: JsonCall<T>, azure: boolean): Promise<T> {
  const url = azure
    ? `${env.azure.endpoint.replace(/\/$/, '')}/openai/deployments/${env.azure.deployment}/chat/completions?api-version=${env.azure.apiVersion}`
    : `${env.openai.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (azure) headers['api-key'] = env.azure.key;
  else headers.authorization = `Bearer ${env.openai.key}`;
  const content = c.user.map((p) => (p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.base64}` } }));
  const body: Record<string, unknown> = {
    messages: [
      { role: 'system', content: c.system },
      { role: 'user', content },
    ],
    temperature: 0.4,
    max_tokens: c.maxTokens ?? 2000,
    response_format: { type: 'json_schema', json_schema: { name: c.name, schema: jsonSchemaOf(c.schema as z.ZodTypeAny), strict: false } },
  };
  if (!azure) body.model = env.openai.model;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? '';
  return c.schema.parse(JSON.parse(text));
}

async function callAnthropic<T>(c: JsonCall<T>): Promise<T> {
  const content = c.user.map((p) => (p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image', source: { type: 'base64', media_type: p.mime, data: p.base64 } }));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.anthropic.key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.anthropic.model,
      max_tokens: c.maxTokens ?? 2000,
      system: c.system,
      messages: [{ role: 'user', content }],
      tools: [{ name: c.name, description: 'Responda preenchendo exatamente este formato.', input_schema: jsonSchemaOf(c.schema as z.ZodTypeAny) }],
      tool_choice: { type: 'tool', name: c.name },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { content: { type: string; input?: unknown }[] };
  const block = data.content.find((b) => b.type === 'tool_use');
  return c.schema.parse(block?.input);
}

/** Chama o provedor; em caso de saída inválida, tenta uma vez com o erro como feedback. */
async function callJson<T>(c: JsonCall<T>): Promise<T> {
  const run = (call: JsonCall<T>) => (env.aiProvider === 'anthropic' ? callAnthropic(call) : callOpenAICompatible(call, env.aiProvider === 'azure-openai'));
  try {
    return await run(c);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      return run({ ...c, user: [...c.user, { type: 'text', text: `Sua resposta anterior era inválida (${String(err).slice(0, 300)}). Responda novamente seguindo exatamente o formato.` }] });
    }
    throw err;
  }
}

export function isLlmConfigured(): boolean {
  if (env.aiProvider === 'openai') return !!env.openai.key;
  if (env.aiProvider === 'azure-openai') return !!(env.azure.endpoint && env.azure.key && env.azure.deployment);
  if (env.aiProvider === 'anthropic') return !!env.anthropic.key;
  return false;
}

export const llmProvider: AIProvider = {
  name: env.aiProvider,
  generateConcept: (i) =>
    callJson({ name: 'conceito_campanha', system: conceptSystemPrompt(i), user: [{ type: 'text', text: conceptUserPrompt(i) }], schema: ConceptSchema }),
  interpretEdit: (i) =>
    callJson({ name: 'edicao_peca', system: editSystemPrompt(i), user: [{ type: 'text', text: editUserPrompt(i) }], schema: EditResultSchema, maxTokens: 1500 }),
  critique: (i) =>
    callJson({
      name: 'critica_peca',
      system: critiqueSystemPrompt(i),
      user: [
        { type: 'image', base64: i.png.toString('base64'), mime: 'image/png' },
        { type: 'text', text: `Textos da peça: ${i.textSummary}` },
      ],
      schema: CritiqueSchema,
      maxTokens: 1200,
    }),
};
