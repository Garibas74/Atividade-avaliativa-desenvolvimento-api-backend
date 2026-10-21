FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/api/package*.json ./
RUN npm ci --omit=dev
COPY services/api/ ./
RUN npx prisma generate
COPY frontend/ ./public/
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/server.js"]
