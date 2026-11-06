# Serveur vocal Callpme — à construire depuis la racine du dépôt :
#   docker build -f voice-server/Dockerfile -t callpme-voice .
FROM node:20-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
COPY voice-server ./voice-server

ENV NODE_ENV=production
ENV VOICE_SERVER_PORT=4100
EXPOSE 4100
USER node
CMD ["npx", "tsx", "voice-server/server.ts"]
