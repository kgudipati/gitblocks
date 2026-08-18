FROM node:24.18.0-bookworm-slim AS toolchain

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

WORKDIR /workspace

FROM toolchain AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/gitblocks-hosted/package.json apps/gitblocks-hosted/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/retrieval/package.json packages/retrieval/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY apps/gitblocks-hosted apps/gitblocks-hosted
COPY packages/contracts packages/contracts
COPY packages/domain packages/domain
COPY packages/persistence packages/persistence
COPY packages/retrieval packages/retrieval

RUN pnpm --filter @gitblocks/gitblocks-hosted... build
RUN pnpm --config.inject-workspace-packages=true \
    --filter @gitblocks/gitblocks-hosted deploy --prod \
    /production/apps/gitblocks-hosted
RUN find /production/apps/gitblocks-hosted -type f \
      \( -name '*.ts' -o -name '*.ts.map' -o -name '*.tsbuildinfo' \) \
      -delete && \
    rm -rf \
      /production/apps/gitblocks-hosted/examples \
      /production/apps/gitblocks-hosted/scripts \
      /production/apps/gitblocks-hosted/src \
      /production/apps/gitblocks-hosted/test && \
    find /production/apps/gitblocks-hosted -type d -empty -delete && \
    rm -f \
      /production/apps/gitblocks-hosted/pnpm-lock.yaml \
      /production/apps/gitblocks-hosted/pnpm-workspace.yaml

FROM node:24.18.0-bookworm-slim AS production

ENV NODE_ENV=production

WORKDIR /workspace

COPY --from=build --chown=node:node \
  /production/apps/gitblocks-hosted \
  /workspace/apps/gitblocks-hosted
COPY --chown=node:node \
  catalog/capability-taxonomy/1.0.0/manifest.json \
  /workspace/catalog/capability-taxonomy/1.0.0/manifest.json
COPY --chown=node:node \
  catalog/capability-retrieval-expansion/1.0.0/manifest.json \
  /workspace/catalog/capability-retrieval-expansion/1.0.0/manifest.json

USER node

EXPOSE 3333

CMD ["node", "apps/gitblocks-hosted/dist/scripts/mcp-cli.js"]
