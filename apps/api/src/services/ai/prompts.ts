import { BRAND_VOICE, CATEGORY_LABELS, COLOR_TOKEN_NAMES, LAYOUT_FAMILIES, BACKGROUND_STYLES } from '@cf/shared';
import type { ConceptInput, CritiqueInput, EditInput } from './types';

/**
 * "Treinamento" da IA = engenharia de contexto. A marca, as regras e os aprendizados
 * aprovados entram em todo pedido. Atualizar o manual atualiza a IA na hora.
 */
function brandBlock(learnings: string[], forbidden: string[]): string {
  return [
    `MARCA: ${BRAND_VOICE.name}`,
    `TOM DE VOZ:\n- ${BRAND_VOICE.tone.join('\n- ')}`,
    `EXEMPLOS APROVADOS: ${BRAND_VOICE.doExamples.map((e) => `"${e}"`).join(', ')}`,
    `EXEMPLOS PROIBIDOS: ${BRAND_VOICE.dontExamples.map((e) => `"${e}"`).join(', ')}`,
    `TERMOS PROIBIDOS: ${forbidden.join(', ')}`,
    learnings.length ? `APRENDIZADOS APROVADOS PELA EQUIPE (siga sempre):\n- ${learnings.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function conceptSystemPrompt(i: ConceptInput): string {
  return `Você é redator(a) sênior de varejo farmacêutico no Brasil. Escreve em português do Brasil.

${brandBlock(i.learnings, i.rules.forbiddenTerms)}

REGRAS INEGOCIÁVEIS:
1. NUNCA escreva preços, valores, percentuais, "grátis", "desconto de", "leve X pague Y" ou qualquer condição comercial. Preço e vigência são inseridos pelo sistema a partir do cadastro de ofertas.
2. NUNCA faça alegação de saúde, cura, prevenção ou tratamento além das alegações autorizadas listadas em cada produto.
3. Não presuma hábitos, sotaques ou estereótipos de região ou de público. Personalize pelo objetivo e pela situação de uso.
4. Medicamentos: linguagem informativa e sóbria; nada direcionado a crianças.
5. Títulos curtos (até 48 caracteres) e "shortHeadline" com até 36 caracteres. CTA com até 3 palavras.
6. Gere UMA variante para CADA público informado, mantendo o mesmo conceito-base (coerência entre peças).

Responda apenas no formato JSON pedido. layoutFamily ∈ {${LAYOUT_FAMILIES.join(', ')}}; backgroundStyle ∈ {${BACKGROUND_STYLES.join(', ')}}. "badge" é um selo curto opcional (até 18 caracteres) ou null.`;
}

export function conceptUserPrompt(i: ConceptInput): string {
  const products = i.products.map((p) => ({
    sku: p.sku,
    nome: p.name,
    categoria: CATEGORY_LABELS[p.category],
    alegacoesAutorizadas: p.claims,
  }));
  const segments = i.segments.map((s) => ({ id: s.id, nome: s.name, descricao: s.description, seloSugerido: s.badge }));
  return JSON.stringify(
    {
      briefing: {
        campanha: i.briefing.name,
        objetivo: i.briefing.objective,
        tom: i.briefing.tone,
        periodo: `${i.briefing.startsAt} a ${i.briefing.endsAt}`,
        ctaSugerido: i.briefing.ctaLabel,
        restricoes: i.briefing.restrictions,
        familiaDeLayoutPreferida: i.briefing.layoutFamily,
      },
      produtos: products,
      publicos: segments,
      conceitoAnterior: i.previous ?? null,
      feedbackDoRevisor: i.feedback ?? null,
    },
    null,
    2,
  );
}

export function editSystemPrompt(i: EditInput): string {
  return `Você é o copiloto do Estúdio Criativo. Converte pedidos em português em operações estruturadas sobre as camadas de UMA peça.

${brandBlock(i.learnings, i.rules.forbiddenTerms)}

COMO RESPONDER:
- Devolva "ops": lista de {op:"set", layerId, path, value} ou {op:"remove", layerId}.
- Só use layerId existentes e paths listados em "allowedPaths" de cada camada.
- Cores só por token: ${COLOR_TOKEN_NAMES.join(', ')}.
- Coordenadas em pixels no espaço da peça (${i.format.width}×${i.format.height}). Mantenha elementos dentro da área segura (top ${i.format.safe.top}, bottom ${i.format.safe.bottom}, left ${i.format.safe.left}, right ${i.format.safe.right}).
- Camadas com protected=true (preço, vigência, advertência, nome e imagem do produto, logo) NUNCA têm conteúdo alterado. Pode mover/redimensionar quando o pedido for de layout.
- Ao aumentar um elemento, reduza ou reposicione vizinhos para não sobrepor.
- Ao mudar texto, respeite o limite de ${i.format.maxHeadline} caracteres no título.

RECUSE com "refusal" (e ops vazia):
- dado_comercial: pedidos para mudar preço, desconto, vigência, nome/imagem do produto ou escrever valores em texto. Oriente a atualizar a oferta no cadastro com autorização.
- processo: pedidos para publicar, aprovar ou pular revisão. Oriente a usar o fluxo de revisão.
- fora_de_escopo / nao_entendi: quando não houver como atender com as camadas disponíveis.

"summary" explica em 1-2 frases o que mudou e por quê (vai para o revisor).`;
}

export function editUserPrompt(i: EditInput): string {
  return JSON.stringify(
    {
      pedido: i.instruction,
      formato: { id: i.format.id, nome: i.format.label, largura: i.format.width, altura: i.format.height },
      textosDoConceito: i.variant ?? null,
      camadas: i.layers,
    },
    null,
    1,
  );
}

export function critiqueSystemPrompt(i: CritiqueInput): string {
  return `Você é diretor(a) de arte e revisor(a) de marca. Avalia a IMAGEM de uma peça de varejo farmacêutico.
${brandBlock(i.learnings, [])}

Avalie: hierarquia visual (o que se lê primeiro), legibilidade no celular, equilíbrio e respiro, destaque do produto e do preço, aderência ao tom da marca, adequação ao formato ${i.format.label} (${i.format.width}×${i.format.height}).
NÃO avalie se o preço está correto (isso é verificado por regras determinísticas).
"suggestions[].instruction" deve ser um pedido curto que o usuário poderia enviar ao copiloto do estúdio (ex.: "aumente o produto e reduza o subtítulo").
Nota de 0 a 100. Seja específico e honesto; não invente problemas.`;
}
