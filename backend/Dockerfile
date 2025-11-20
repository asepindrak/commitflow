# =======================
# STAGE 1: BASE
# =======================
FROM node:22-slim AS base
WORKDIR /app

# Install system deps (Prisma & build)
RUN apt-get update && apt-get install -y \
    bash \
    git \
    python3 \
    make \
    g++ \
    libc6-dev \
    dumb-init \
    openssl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Update npm versi terbaru
RUN npm install -g npm@11

# Salin dependency info lebih dulu
COPY package*.json ./

# Install dependencies (flexible for dev)
RUN npm install --legacy-peer-deps

# (JANGAN generate Prisma di sini — kita akan generate di builder setelah copy seluruh schema & source)

# =======================
# STAGE 2: DEVELOPMENT
# =======================
FROM base AS development
ENV NODE_ENV=development
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
ENV CHOKIDAR_INTERVAL=500

WORKDIR /app

# Copy semua source (untuk container dev yang standalone)
COPY . .

# Expose port NestJS dev server
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:dev"]

# =======================
# STAGE 3: BUILD (Production)
# =======================
FROM base AS builder
WORKDIR /app

# Copy source to builder (schemas, src, tsconfig, dll.)
COPY . .

# Generate Prisma client inside builder (ensures binaries match this environment)
RUN npx prisma generate

# Build NestJS (kompilasi ke dist)
RUN npm run build

# Optional: remove dev deps to slim node_modules if you want
# RUN npm prune --production

# =======================
# STAGE 4: PRODUCTION
# =======================
FROM node:22-slim AS production
WORKDIR /app

# Install minimal runtime deps including openssl
RUN apt-get update && apt-get install -y \
    dumb-init \
    openssl \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Jakarta
ENV NODE_ENV=production

# Copy hasil build dan dependensi dari builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./ 
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
