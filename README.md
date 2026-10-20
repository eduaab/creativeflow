# CreativeFlow AI

Protótipo funcional para o desafio **Creative AI — marketing em escala com inteligência artificial** (Hackabusiness 2026).

> Um briefing estruturado vira dezenas de peças multicanal (por praça, público e formato), com a identidade da marca preservada e **nada exportado sem conformidade**.
> A IA escreve e sugere; templates da marca montam; regras determinísticas e pessoas decidem.

⚠️ **Repositório confidencial.** Mantenha-o privado. Todos os produtos, marcas, preços e o manual de marca são **sintéticos**. O código não usa nem presume dados internos da empresa parceira.

---

## O que funciona de verdade (P0 + P1)

| Capacidade | Onde ver | Como é garantida |
|---|---|---|
| Briefing com pré-validação (sem oferta, vencida, prescrição, MIP) | Nova campanha | `previewBriefing` no servidor |
| Conceito por público gerado por IA (ou modo demonstração) | Campanha › Conceito | `services/ai` + saída validada com Zod |
| **Escala**: 1 conceito → N peças (praças × públicos × formatos × produtos + encarte) | Campanha › Peças | `buildCreativeDoc` (templates determinísticos) |
| 5 formatos: Feed 1:1, Feed 4:5, Stories 9:16, Banner, **Encarte multi-oferta** | Peças | `packages/shared/src/templates.ts` |
| Preço, vigência, nome/imagem do produto e advertência **travados** (vêm do cadastro) | Estúdio › Editar | `binding` + `filterOps` |
| Edição manual no canvas (arrastar, redimensionar, estilo, desfazer) | Estúdio | patch → nova versão |
| Pedido em linguagem natural → **patch estruturado**, prévia antes/depois, confirmação | Estúdio › Copiloto | barreira de regras **antes** da IA + filtro **depois** |
| Replicar uma edição para a mesma peça nas outras praças | Copiloto › escopo | `scope: siblings` |
| 22 regras determinísticas (comercial, marca, formato, regulatório) | Estúdio › Regras | `packages/shared/src/rules.ts` |
| **Aprovação por conceito + exceção** (o revisor não aprova 60 arquivos) | Aprovações | `deriveStatus` |
| Nova versão nunca herda aprovação; erro crítico sempre bloqueia | — | `governance.ts` + testes |
| Oferta que vence durante a revisão derruba a liberação | Admin › Demonstração | revalidação na exportação |
| Exportação ZIP com `manifest.json` e `relatorio.csv` (versão, aprovador, oferta) | Exportar aprovadas | gate no servidor |
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

No `.env`, escolha um provedor (a troca não muda nenhuma outra parte do sistema):

```bash
AI_PROVIDER=azure-openai   # ou openai | anthropic
AZURE_OPENAI_ENDPOINT=https://<recurso>.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=<deployment com saída JSON e visão>
```

Se o provedor falhar, a resposta cai no modo demonstração e isso fica registrado (e visível na interface como "contingência").

---

## Testes

```bash
pnpm test
```

- `packages/shared/test/core.test.ts` (44): todos os 30 templates saem sem crítico/alerta; preço em texto livre bloqueia; praça sem oferta bloqueia sem inventar preço; oferta vencida/de outra praça bloqueia; patch não altera preço/advertência/cor fora da paleta; MIP sem advertência bloqueia; Rx bloqueia; aprovação por herança e exceção.
- `apps/api/test/flow.test.ts` (10): jornada ponta a ponta pela API, incluindo PNG real, gate de exportação, data simulada e importação de planilha.
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
