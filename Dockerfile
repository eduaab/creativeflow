# Imagem única: API + front-end buildado + Chromium para exportar PNG.
# A imagem oficial do Playwright já traz o Chromium compatível com playwright-core 1.56.
FROM mcr.microsoft.com/playwright:v1.56.0-noble

ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/app/data \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN NODE_ENV=development pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @cf/web build

VOLUME ["/app/data"]
EXPOSE 3001
CMD ["pnpm", "--filter", "@cf/api", "start"]
