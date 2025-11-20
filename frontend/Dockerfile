# ========================= 
# STAGE 1: BASE
# =========================
FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm install -g npm@11

# =========================
# STAGE 2: DEPENDENCIES
# =========================
FROM base AS deps
RUN npm install

# =========================
# STAGE 3: BUILD (Production)
# =========================
FROM deps AS builder

ARG VITE_API_URL

ENV VITE_API_URL=${VITE_API_URL}

COPY . .
RUN npm run build

# =========================
# STAGE 4: DEVELOPMENT
# =========================
FROM deps AS development
ENV NODE_ENV=development
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
ENV CHOKIDAR_INTERVAL=500

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]

# =========================
# STAGE 5: PRODUCTION
# =========================
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
