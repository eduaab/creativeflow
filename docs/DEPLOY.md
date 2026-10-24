# Publicar o protótipo online

O desafio pede um **protótipo funcional acessível**. O projeto já sai pronto para isso: uma única imagem Docker
roda a API, serve o front-end e traz o Chromium usado na exportação dos PNGs. O banco é Postgres (o mesmo SQL
do PGlite usado em desenvolvimento). Na primeira subida, o banco vazio recebe os dados sintéticos automaticamente.

## Opção recomendada: Render (gratuito, ~10 minutos)

1. Faça o `git push` do repositório (privado) para o GitHub.
2. Em <https://dashboard.render.com>, entre com o GitHub e clique em **New → Blueprint**.
3. Escolha o repositório. O Render lê o `render.yaml` e mostra o que vai criar:
   - `creativeflow` (serviço web, Docker);
   - `creativeflow-db` (Postgres).
4. Na mesma tela ele pede os valores marcados como secretos:
   - `OPENAI_API_KEY`: a chave do Google AI Studio (Gemini). Pode deixar vazio por enquanto.
   - `APP_PUBLIC_URL`: deixe vazio na primeira vez; depois preencha com a URL que o Render gerar.
   - `TEAMS_WEBHOOK_URL`: opcional.
5. Clique em **Apply**. O primeiro build leva alguns minutos (a imagem do Playwright é grande).
6. Abra a URL `https://creativeflow-xxxx.onrender.com`. O login mostra os três usuários de demonstração.

### Ligar a IA real
No serviço `creativeflow` → **Environment**:
- `OPENAI_API_KEY` = sua chave;
- `AI_PROVIDER` = `openai`.

Salve; o Render reinicia sozinho. O rodapé do menu e o log de inicialização mostram `IA: openai (ia-generativa)`.
Se a cota do Gemini acabar durante a demo, o sistema cai no modo demonstração e avisa na tela.

### Limites do plano gratuito (saber antes da banca)
- O serviço **hiberna após ~15 min sem acesso**; o primeiro acesso depois disso leva ~1 minuto.
  Abra a URL alguns minutos antes de apresentar.
- 512 MB de memória: suficiente para a demo; exportações muito grandes (dezenas de peças) podem demorar.
- Os ZIPs exportados ficam no disco do serviço, que é apagado a cada deploy. Baixe o ZIP logo após exportar.
- O Postgres gratuito expira depois de 30 dias — cobre o período do hackathon.

## Alternativa: Azure Container Apps

Para um piloto real dentro do ambiente do cliente, a mesma imagem roda em Azure Container Apps com
Azure Database for PostgreSQL e Azure OpenAI (`AI_PROVIDER=azure-openai`). Nada no código muda: só variáveis de ambiente.

Passos resumidos: publicar a imagem no Azure Container Registry, criar o Container App com ingress externo na
porta 3001, guardar `DATABASE_URL`, `JWT_SECRET` e a chave da IA como *secrets* do app e apontar
`AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_DEPLOYMENT` para o recurso do Azure OpenAI.

## Rodar a imagem localmente (opcional)

```bash
docker compose up --build    # sobe Postgres + app em http://localhost:3001
```

## Checklist antes de enviar o link
- [ ] Login funciona e as 3 praças aparecem.
- [ ] Criar campanha → conceito → peças → aprovar conceito → exportar ZIP.
- [ ] `GET /api/health` responde `{"ok":true}`.
- [ ] O repositório continua **privado** e o `.env` não foi versionado (`git ls-files | grep .env` só mostra `.env.example`).
