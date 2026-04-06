# # ---------- STAGE 1: BUILD ----------
# FROM node:18-alpine AS build

# WORKDIR /app

# # Instala dependências necessárias para o build
# COPY package*.json ./
# RUN npm install

# # Copia o código-fonte e compila o projeto
# COPY . .
# RUN npm run build

# # ---------- STAGE 2: RUN ----------
# FROM node:18-alpine

# # Instala Chromium e dependências necessárias para Puppeteer
# RUN apk add --no-cache \
#     chromium \
#     nss \
#     freetype \
#     harfbuzz \
#     ca-certificates \
#     ttf-freefont \
#     dumb-init \
#     udev \
#     xvfb \
#     && rm -rf /var/cache/apk/*

# # Define variáveis para o Puppeteer usar o Chromium instalado
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# ENV NODE_ENV=production

# WORKDIR /usr/src/app

# # Copia apenas o build e as dependências necessárias
# COPY package*.json ./
# RUN npm ci --omit=dev

# COPY --from=build /app/dist ./dist

# EXPOSE 8081
# CMD ["dumb-init", "node", "dist/main"]
# ---------- STAGE 1: BUILD ----------
# ---------- STAGE 1: BUILD ----------
FROM node:20-slim AS build

WORKDIR /app

# Copia arquivos do Node
COPY package*.json ./

# Instala dependências necessárias para canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Instala todas dependências
RUN npm ci

# Copia código fonte
COPY . .

# Compila NestJS
RUN npm run build

# ---------- STAGE 2: RUN ----------
FROM node:20-slim

WORKDIR /usr/src/app

# Instala Chromium e libs para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libcups2 \
    libxshmfence1 \
    libxrender1 \
    libxi6 \
    libxtst6 \
    libpangocairo-1.0-0 \
    libpangoft2-1.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

# Variáveis de ambiente Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

# Copia dependências do build
COPY --from=build /app/node_modules ./node_modules

# Copia build compilado
COPY --from=build /app/dist ./dist

# Copia package.json para referência
COPY package*.json ./

# Exposição de porta
EXPOSE 8081

# Comando final
CMD ["node", "dist/main"]