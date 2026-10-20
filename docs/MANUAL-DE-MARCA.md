# Manual de marca sintético — critério de construção

O desafio pede um manual construído **a partir da observação de materiais públicos**, com o critério documentado. Este arquivo é esse registro. O código lê **apenas** `packages/shared/src/brand/brand.ts`; trocar a marca é editar esse arquivo.

> Estado atual: tokens **neutros e provisórios** ("Farmácia Exemplo") para o protótipo funcionar desde o primeiro dia. Antes da entrega, preencha a tabela de observações e ajuste os tokens.

## 1. Método

1. **Coleta (manual, pequena amostra):** 15–25 peças públicas recentes (site, app, Instagram, encarte por estado). Registre a URL, a data de acesso e uma captura de tela guardada no drive privado do time, nunca no repositório.
2. **Extração:** para cada peça, anote a paleta dominante (conta-gotas), a hierarquia (o que se lê primeiro), a família tipográfica aparente, a posição do logo, como o preço aparece e o tom do texto.
3. **Consolidação:** um elemento só entra no manual se aparecer em pelo menos **60%** da amostra. Divergências viram nota, não regra.
4. **Decisão:** cada token tem uma linha "por quê", ligada às observações.
5. **Limite:** nada de diretrizes internas, arquivos-fonte da marca ou logos oficiais vetorizados. Fontes pagas são substituídas por equivalentes livres (Google Fonts) e a substituição fica documentada.

## 2. Registro de observações (preencher)

| # | Fonte pública (URL) | Acesso | Canal | Observação | Usado em |
|---|---|---|---|---|---|
| 1 | | | Instagram | | cor primária |
| 2 | | | Encarte (estado) | ex.: preço em etiqueta de alto contraste, "De/Por" | `price-tag` |
| 3 | | | Site | | tom de voz |

## 3. Tokens atuais e justificativa

| Token | Valor | Por quê (provisório) |
|---|---|---|
| `primary` | `#0E5E6F` | Cor institucional de alto contraste com branco (7:1) |
| `accent` | `#E8530A` | Destaque de preço; contraste ≥ 3:1 com branco em texto grande |
| `sun` | `#FFC93C` | Selos e CTA secundário |
| `ink` / `muted` | `#13262B` / `#41545A` | Texto ≥ 4,5:1 sobre fundos claros |
| Fonte de título | Poppins (livre) | Geométrica, legível em tamanho grande |
| Fonte de texto | Inter (livre) | Legibilidade em corpo pequeno (vigência, advertência) |

## 4. Tom de voz (enviado à IA em todo pedido)

- Claro, acolhedor e objetivo; fala de cuidado no dia a dia.
- Frases curtas; imperativo gentil.
- Sem superlativos absolutos, sem promessas de resultado de saúde.
- No máximo uma exclamação por peça.

**Termos proibidos** e **alegações que exigem autorização** são configuráveis em *Marca e regras* e versionados (`rulesVersion` aparece em cada validação e no manifesto da exportação).

## 5. Como o manual vira governança

| Manual | Regra no código |
|---|---|
| Paleta fechada | `MAR-002` crítico; editor e IA só aceitam tokens |
| Logo obrigatório e tamanho mínimo | `MAR-001` |
| Termos proibidos | `MAR-004` crítico |
| Tom (exclamações, caixa alta) | `MAR-005` informativo |
| Contraste mínimo | `FMT-004` |
| Área segura por canal | `FMT-002` |
