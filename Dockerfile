# syntax=docker/dockerfile:1.7
FROM node:22.16.0-bookworm-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable \
  && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Dependency layers remain cached until the lockfile or package metadata changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm release:check \
  && pnpm check \
  && pnpm test \
  && pnpm build

ENV NODE_ENV=production \
    HOST=0.0.0.0

# Pre-deploy migrations require drizzle-kit and tsx, so development tooling is
# intentionally retained in the image. The application still runs as non-root.
RUN chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
