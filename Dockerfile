FROM node:22-bookworm-slim

WORKDIR /app

# Библиотеки для Prisma
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Копируем зависимости и Prisma
COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код Eclpse
COPY . .

# Настройки Next.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2560"

# Временный Redis URL только для сборки
# Не содержит настоящих паролей
ARG BUILD_REDIS_URL=redis://127.0.0.1:6379

# Public frontend configuration only; never pass private service secrets here.
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER=eu
ARG NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID

# Собираем Next.js
RUN REDIS_URL="$BUILD_REDIS_URL" npm run build

# Порт приложения
EXPOSE 3000

# Запускаем Eclpse
CMD ["npm", "run", "start"]
