# CreativeFlow AI

Protótipo funcional para o desafio **Creative AI — marketing em escala com inteligência artificial** (Hackabusiness 2026).

## Sobre o projeto

O CreativeFlow AI nasceu de um problema simples de enunciar e difícil de resolver: a demanda por conteúdo cresce mais rápido do que a capacidade das equipes. No marketing de varejo, uma única campanha precisa de versões para cada formato, canal, público e estado. Cada adaptação feita à mão consome tempo e abre espaço para erros caros, como um preço de outra praça, uma oferta vencida ou um remédio sem a advertência obrigatória.

A solução divide o trabalho em três papéis: a IA escreve, a marca monta, e as regras e as pessoas decidem. A partir de um briefing, a IA cria o conceito da campanha e os textos de cada público, inclusive para push, e-mail e WhatsApp. Templates da identidade visual montam automaticamente todas as peças (feed, stories, banner e encarte), e preço, vigência e advertências vêm direto do cadastro de ofertas, travados contra edição. A equipe pode ajustar qualquer peça à mão ou pedir à IA em português, sempre com prévia antes de aplicar.

A governança faz parte do produto. Regras automáticas bloqueiam preço digitado, oferta vencida, alegação de saúde proibida e remédio sem advertência, e uma revisão semântica da IA aponta riscos que regras fixas não pegam. O revisor aprova o conceito uma vez, e as peças sem pendência são liberadas automaticamente; só as exceções vão para a fila. Na exportação, o sistema confere tudo de novo e gera um arquivo ZIP: ao extrair, a equipe encontra as peças em PNG, organizadas por estado e formato e prontas para publicar, junto com o relatório de quem aprovou cada uma, qual oferta foi usada e os textos finais de cada canal. Também é possível baixar uma peça avulsa direto do editor.

O MVP funciona de ponta a ponta com dados sintéticos e marca construída a partir de materiais públicos. A IA é plugável (Gemini, OpenAI, Azure OpenAI ou Anthropic), sem necessidade de treinar um modelo próprio. Catálogo, ofertas, login e notificações no Teams foram desenhados para trocar pelos sistemas reais do cliente sem refazer a solução. O resultado é mais escala, a mesma marca e controle real: a IA acelera o processo, e as pessoas seguem decidindo.


> Um briefing estruturado vira dezenas de peças multicanal (por praça, público e formato), com a identidade da marca preservada e **nada exportado sem conformidade**.
> A IA escreve e sugere; templates da marca montam; regras determinísticas e pessoas decidem.

ℹ️ **Dados sintéticos.** Todos os produtos, marcas, preços, usuários e o manual de marca são fictícios. O repositório não contém dados internos de empresas nem de clientes.

---

## O que funciona de verdade (P0 + P1)

| Capacidade | Onde ver | Como é garantida |
|---|---|---|
| Briefing com pré-validação (sem oferta, vencida, prescrição, MIP) | Nova campanha | `previewBriefing` no servidor |
| Conceito por público gerado por IA (ou modo demonstração) | Campanha › Conceito | `services/ai` + saída validada com Zod |
| **Escala**: 1 conceito → N peças (praças × públicos × formatos × produtos + encarte) | Campanha › Peças | `buildCreativeDoc` (templates determinísticos) |
| 5 formatos: Feed 1:1, Feed 4:5, Stories 9:16, Banner, **Encarte multi-oferta** | Peças | `packages/shared/src/templates.ts` |
| 3 famílias de layout (clássico, destaque, faixa) × 3 fundos, escolhidas pela IA ou no briefing | Nova campanha / Conceito | templates testados: todas as combinações saem sem alerta |
| **Textos por canal** (push, e-mail, WhatsApp) no mesmo conceito, com as mesmas regras; preço, vigência e advertência entram pelo cadastro de cada praça | Conceito › Textos por canal | `packages/shared/src/messages.ts` |
| A IA usa conceitos já **aprovados** em campanhas anteriores como referência de estilo | Auditoria do conceito | `listApprovedConceptExamples` → prompt |
| Preço, vigência, nome/imagem do produto e advertência **travados** (vêm do cadastro) | Estúdio › Editar | `binding` + `filterOps` |
| Edição manual no canvas (arrastar, redimensionar, estilo, desfazer) | Estúdio | patch → nova versão |
| Pedido em linguagem natural → **patch estruturado**, prévia antes/depois, confirmação | Estúdio › Copiloto | barreira de regras **antes** da IA + filtro **depois** |
| Replicar uma edição para a mesma peça nas outras praças | Copiloto › escopo | `scope: siblings` |
| 22 regras determinísticas (comercial, marca, formato, regulatório) | Estúdio › Regras | `packages/shared/src/rules.ts` |
| **Revisão semântica da IA (IA-001)**: aponta alegação de saúde disfarçada, promessa de preço implícita, tom, estereótipo, incoerência e remédio dirigido a crianças. **Só endurece**: manda para revisão, nunca libera nem bloqueia; o revisor pode descartar falso positivo com motivo | Conceito e Estúdio › Regras | `semantic.service.ts` + `shared/semantic.ts` |
| **Aprovação por conceito + exceção** (o revisor não aprova 60 arquivos) | Aprovações | `deriveStatus` |
| Nova versão nunca herda aprovação; erro crítico sempre bloqueia | — | `governance.ts` + testes |
| Oferta que vence durante a revisão derruba a liberação | Admin › Demonstração | revalidação na exportação |
| Exportação ZIP com `manifest.json`, `relatorio.csv` e `textos-canais.csv` (versão, aprovador, oferta, textos finais por praça) | Exportar aprovadas | gate no servidor |
| Revisor de marca com IA multimodal (consultivo, nunca bloqueia) | Estúdio › Revisão | renderiza PNG e envia à IA |
| Aprendizados da marca a partir de reprovações (sem fine-tuning) | Marca e regras › Aprendizados | entram no contexto da IA |
| Importação de planilha de ofertas CSV/XLSX + revalidação automática | Catálogo e ofertas | `import.service.ts` |
| Notificação no Teams (Adaptive Card) quando há exceções | `.env` `TEAMS_WEBHOOK_URL` | `notify.service.ts` |
| Trilha de auditoria completa e métricas medidas | Campanha › Auditoria / Métricas | `audit_events` |

O que é **planejado** e não está implementado está em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md#o-que-nao-esta-implementado).

---

## Rodando localmente

Requisitos: Node 20+ e pnpm 9+ (`corepack enable`).

```bash
pnpm install
cp .env.example .env        # opcional: sem chave de IA roda em "modo demonstração"
pnpm dev                    # API em :3001 e web em http://localhost:5173
```

Não precisa instalar banco: sem `DATABASE_URL`, a API usa **PGlite** (Postgres embutido, arquivo em `data/pglite`). A base sintética é carregada no primeiro start.

Exportar PNG usa Chromium headless. Se não for encontrado automaticamente: `npx playwright install chromium` ou defina `CHROMIUM_PATH`.

### Com Docker (Postgres real)

```bash
docker compose up --build   # http://localhost:3001
```

### Usuários de demonstração

| Usuário | Perfil | Pode |
|---|---|---|
| Ana Souza | Criação / marketing | criar briefing, gerar, editar, pedir à IA, exportar aprovadas |
| Rui Lima | Revisão / liderança | aprovar conceito, decidir exceções |
| Bia Costa | Administração | tudo + regras, ofertas, aprendizados, data simulada |

### Ligando uma IA real

No `.env`, escolha um provedor (a troca não muda nenhuma outra parte do sistema). Exemplo com Gemini, pelo endpoint compatível com OpenAI:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=<chave do Google AI Studio>   # nunca versionar
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
OPENAI_MODEL=gemini-3.1-flash-lite
OPENAI_FALLBACK_MODELS=gemini-3.5-flash-lite,gemini-flash-lite-latest
AI_TIMEOUT_MS=120000
```

Também funciona com `azure-openai` (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`) e `anthropic`.
Em sobrecarga (429/503) ou demora, a API tenta de novo e troca para os modelos reserva. Se tudo falhar, cai no modo
demonstração, e a interface mostra **o motivo** ("IA real falhou: …"), também gravado na auditoria.

### Publicar online

`render.yaml` sobe o protótipo no Render (Docker + Postgres) em poucos cliques. Passo a passo e limites do plano gratuito em [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Testes

```bash
pnpm test
```

- `packages/shared/test/core.test.ts` (65): a IA-001 só gera alerta, nunca crítico, e só para o público afetado; todos os 45 templates (formatos × famílias × fundos) saem sem crítico/alerta; textos por canal bloqueiam preço digitado e recebem preço/vigência/advertência do cadastro; preço em texto livre bloqueia; praça sem oferta bloqueia sem inventar preço; oferta vencida/de outra praça bloqueia; patch não altera preço/advertência/cor fora da paleta; MIP sem advertência bloqueia; Rx bloqueia; aprovação por herança e exceção.
- `apps/api/test/flow.test.ts` (12): revisão semântica tirando a herança, descarte pelo revisor e apontamento em edição manual; jornada ponta a ponta pela API, incluindo PNG real, gate de exportação, textos por canal, exemplos aprovados, data simulada e importação de planilha.
- `scripts/ui-smoke.mjs`: percorre a interface inteira num navegador headless e salva screenshots (bom para checar antes de gravar o vídeo).

---

## Estrutura

```
apps/
  api/            Node + Express (MVC em camadas)
    src/models/       acesso a dados (SQL; PGlite ou Postgres)
    src/services/     regras de negócio: geração, edição, IA, revisão, exportação…
    src/controllers/  entrada HTTP → serviços
    src/views/        presenters (formato JSON da API)
    src/routes/       rotas + permissões por perfil
  web/            React + Vite + Tailwind (briefing, estúdio, aprovações…)
packages/
  shared/         núcleo compartilhado por API e web
    brand/            manual de marca sintético (tokens, voz, logo)
    domain.ts         tipos e schemas Zod
    templates.ts      biblioteca de layouts por formato
    render/Artboard   renderizador ÚNICO (editor = exportação)
    patch.ts          operações, política de campos protegidos, diff
    rules.ts          motor de regras determinístico
    governance.ts     estados e aprovação por conceito + exceção
docs/             arquitetura, manual de marca, roteiro de demo
```

Documentação: [Arquitetura e decisões](docs/ARQUITETURA.md) · [Manual de marca sintético](docs/MANUAL-DE-MARCA.md) · [Roteiro da demo e do pitch](docs/ROTEIRO-DEMO.md)
