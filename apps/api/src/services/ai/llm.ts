import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { env } from '../../config/env';
import { conceptSystemPrompt, conceptUserPrompt, critiqueSystemPrompt, editSystemPrompt, editUserPrompt, semanticSystemPrompt, semanticUserPrompt } from './prompts';
import { LenientConceptSchema, LenientCritiqueSchema, LenientEditSchema, LenientSemanticSchema } from './lenient';
import type { AIProvider } from './types';

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
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  maxTokens?: number;
}

function jsonSchemaOf(schema: z.ZodTypeAny): Record<string, unknown> {
  const js = zodToJsonSchema(schema, { $refStrategy: 'none' }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

/** Extrai o JSON da resposta, tolerando cercas ```json e texto antes/depois. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new SyntaxError(`Resposta da IA não contém JSON: ${t.slice(0, 120)}`);
  }
}

type FormatMode = 'json_schema' | 'json_object' | 'texto';
/** Lembra qual modo de saída o provedor aceitou, para não repetir tentativas que falham. */
let preferredMode: FormatMode | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = [429, 500, 502, 503, 504];

async function callOpenAICompatible<T>(c: JsonCall<T>, azure: boolean): Promise<T> {
  const url = azure
    ? `${env.azure.endpoint.replace(/\/$/, '')}/openai/deployments/${env.azure.deployment}/chat/completions?api-version=${env.azure.apiVersion}`
    : `${env.openai.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (azure) headers['api-key'] = env.azure.key;
  else headers.authorization = `Bearer ${env.openai.key}`;
  const content = c.user.map((p) => (p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.base64}` } }));
  const schema = jsonSchemaOf(c.schema as z.ZodTypeAny);
  const models = azure ? [''] : [env.openai.model, ...env.openai.fallbackModels];

  // Provedores "compatíveis com OpenAI" (Gemini, Groq, modelos locais…) nem sempre aceitam
  // json_schema completo. Tenta do mais rígido ao mais simples; o Zod valida no fim de qualquer jeito.
  const allModes: FormatMode[] = ['json_schema', 'json_object', 'texto'];
  const modes: FormatMode[] = preferredMode ? [preferredMode, ...allModes.filter((m) => m !== preferredMode)] : allModes;
  const errors: string[] = [];

  for (const model of models) {
    let overloaded = false;
    for (const mode of modes) {
      const system =
        mode === 'json_schema'
          ? c.system
          : `${c.system}\n\nFORMATO OBRIGATÓRIO: responda SOMENTE com um objeto JSON válido (sem markdown, sem comentários) que siga exatamente este JSON Schema:\n${JSON.stringify(schema)}`;
      const body: Record<string, unknown> = {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content },
        ],
        temperature: 0.4,
        max_tokens: Math.max(c.maxTokens ?? 2000, 8192),
      };
      if (mode === 'json_schema') body.response_format = { type: 'json_schema', json_schema: { name: c.name, schema, strict: false } };
      if (mode === 'json_object') body.response_format = { type: 'json_object' };
      if (!azure) body.model = model;

      // Sobrecarga momentânea (503/429): espera e tenta de novo antes de desistir do modelo.
      let res: Response | null = null;
      let timedOut = false;
      for (const wait of [0, 1500, 4000]) {
        if (wait) await sleep(wait);
        try {
          res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(env.aiTimeoutMs) });
        } catch (e) {
          // Tempo esgotado ou rede instável: não adianta repetir o mesmo modelo várias vezes.
          errors.push(`${model || 'deployment'}: sem resposta em ${Math.round(env.aiTimeoutMs / 1000)}s (${String(e).slice(0, 80)})`);
          timedOut = true;
          break;
        }
        if (!TRANSIENT.includes(res.status)) break;
      }
      if (timedOut) {
        overloaded = true; // tenta o próximo modelo reserva
        break;
      }
      if (!res!.ok) {
        const msg = `HTTP ${res!.status} (${model || 'deployment'}, ${mode}): ${(await res!.text()).slice(0, 300)}`;
        errors.push(msg);
        if (TRANSIENT.includes(res!.status)) {
          overloaded = true;
          break; // trocar o formato não resolve sobrecarga: vai para o próximo modelo
        }
        if ([401, 403, 404].includes(res!.status)) {
          if (res!.status === 404 && models.length > 1) break; // modelo inexistente: tenta o reserva
          throw new Error(msg);
        }
        continue; // 400: provável formato não suportado, tenta o próximo modo
      }
      const data = (await res!.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? '';
      try {
        const parsed = c.schema.parse(extractJson(text));
        preferredMode = mode;
        return parsed;
      } catch (e) {
        errors.push(`${mode}: resposta fora do formato (${String(e).slice(0, 300)})`);
      }
    }
    if (!overloaded && errors.length && !errors[errors.length - 1].startsWith('HTTP 404')) break;
  }
  throw new Error(errors.join(' | '));
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
    callJson({ name: 'conceito_campanha', system: conceptSystemPrompt(i), user: [{ type: 'text', text: conceptUserPrompt(i) }], schema: LenientConceptSchema }),
  interpretEdit: (i) =>
    callJson({ name: 'edicao_peca', system: editSystemPrompt(i), user: [{ type: 'text', text: editUserPrompt(i) }], schema: LenientEditSchema, maxTokens: 1500 }),
  semanticReview: (i) =>
    callJson({ name: 'revisao_semantica', system: semanticSystemPrompt(i), user: [{ type: 'text', text: semanticUserPrompt(i) }], schema: LenientSemanticSchema, maxTokens: 1500 }),
  critique: (i) =>
    callJson({
      name: 'critica_peca',
      system: critiqueSystemPrompt(i),
      user: [
        { type: 'image', base64: i.png.toString('base64'), mime: 'image/png' },
        { type: 'text', text: `Textos da peça: ${i.textSummary}` },
      ],
      schema: LenientCritiqueSchema,
      maxTokens: 1200,
    }),
};
