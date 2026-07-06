# --- STAGE 1: Membangun Tampilan (Frontend) ---
FROM node:20-slim AS build-stage
WORKDIR /app

# Install dependencies frontend
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy kode frontend dan build
COPY client/ ./client/
RUN cd client && npm run build

# --- STAGE 2: Menjalankan Server (Backend) ---
FROM node:20-slim
WORKDIR /app

# Install Chromium SISTEM (bukan download dari Puppeteer) beserta SEMUA dependensinya.
# JANGAN pakai --no-install-recommends agar semua paket pendukung Chromium terinstall.
# Install juga 'dbus' agar Chromium tidak crash mencari dbus socket.
RUN apt-get update -y && apt-get install -y \
    openssl \
    chromium \
    dbus \
    && rm -rf /var/lib/apt/lists/*

# ============================================================
# KUNCI UTAMA: Paksa Puppeteer untuk TIDAK download Chrome sendiri.
# Chrome bawaan Puppeteer adalah x86_64, TIDAK BISA jalan di server ARM.
# Kita harus pakai Chromium sistem yang sudah di-install di atas.
# ============================================================
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install dependencies backend (Puppeteer TIDAK akan download Chrome karena ENV di atas)
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy kode server
COPY server/ ./server/
# Ambil hasil build frontend dari Stage 1
COPY --from=build-stage /app/client/dist ./client/dist

# Generate Prisma Client
RUN cd server && npx prisma generate

# Easypanel menggunakan port 3000
EXPOSE 3000

# Buat direktori dbus sebelum jalankan aplikasi agar Chromium tidak crash
CMD ["sh", "-c", "mkdir -p /run/dbus && cd server && npx prisma db push --accept-data-loss && node index.js"]
