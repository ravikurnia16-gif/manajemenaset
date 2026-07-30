# --- STAGE 1: Membangun Tampilan (Frontend) ---
FROM node:20-alpine AS build-stage
WORKDIR /app

# Install dependencies frontend
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy kode frontend dan build
COPY client/ ./client/
RUN cd client && npm run build

# --- STAGE 2: Menjalankan Server (Backend) ---
FROM node:20-alpine
WORKDIR /app

# Install Chromium di Alpine Linux (sangat stabil untuk ARM)
# Juga install dependensi Prisma (openssl, libc6-compat)
RUN apk update && apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    openssl \
    libc6-compat \
    dumb-init

# ============================================================
# KUNCI UTAMA: Paksa Puppeteer untuk TIDAK download Chrome sendiri.
# ============================================================
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
# Di Alpine, binary bernama chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install dependencies backend
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy kode server
COPY server/ ./server/
# Ambil hasil build frontend dari Stage 1
COPY --from=build-stage /app/client/dist ./client/dist

# Generate Prisma Client (libc6-compat ensures binary works on Alpine)
RUN cd server && npx prisma generate

# Easypanel menggunakan port 3000
EXPOSE 3000

# Gunakan dumb-init untuk menangani process signal
ENTRYPOINT ["dumb-init", "--"]

# Jalankan aplikasi
CMD ["sh", "-c", "cd server && node fix_index.js && npx prisma db push --accept-data-loss && node index.js"]
