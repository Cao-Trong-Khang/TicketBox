FROM node:24-slim

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV DOCKER_RUNTIME=true

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:deploy && npm run start:prod"]
