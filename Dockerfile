ARG NODE_VERSION=24
ARG PNPM_VERSION=12.4.2

FROM node:${NODE_VERSION}-slim AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install -g pnpm@${PNPM_VERSION} && pnpm --version
WORKDIR /app

# Full dependency tree: needed to build and to run drizzle-kit migrations.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Runs `drizzle-kit migrate` against DATABASE_URL, then exits.
FROM deps AS migrate
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/lib/server/db ./src/lib/server/db
CMD ["pnpm", "db:migrate"]

FROM deps AS build
# APP_NAME is a static public variable, inlined at build time.
ARG APP_NAME=Storage
ENV APP_NAME=${APP_NAME}
COPY . .
# SvelteKit validates the private variables during the build but reads them at runtime.
# These placeholders only satisfy that validation and never reach the final image.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    ORIGIN=http://localhost \
    BETTER_AUTH_SECRET=build-placeholder \
    S3_ACCESS_KEY_ID=build S3_SECRET_ACCESS_KEY=build S3_BUCKET=build \
    pnpm build

# Production dependencies only: packages in `dependencies` stay external to the server bundle.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "build"]
