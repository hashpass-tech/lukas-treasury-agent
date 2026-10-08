FROM node:24-bookworm-slim
WORKDIR /app
RUN npm install --global pnpm@9.15.9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["pnpm", "dev:local"]
