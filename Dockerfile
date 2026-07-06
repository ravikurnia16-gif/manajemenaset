# --- STAGE 1: Membangun Tampilan (Frontend) ---
FROM node:20 AS build-stage
WORKDIR /app

# Install dependencies frontend
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy kode frontend dan build
COPY client/ ./client/
RUN cd client && npm run build

# --- STAGE 2: Menjalankan Server (Backend) ---
FROM node:20
WORKDIR /app

# Install Chromium SISTEM (bukan download dari Puppeteer) beserta SEMUA dependensinya.
# JANGAN pakai --no-install-recommends agar semua paket pendukung Chromium terinstall.
# Install 'dbus' dan 'dumb-init'
RUN apt-get update -y && apt-get install -y \
    openssl \
    chromium \
    dbus \
    dumb-init \
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

# Gunakan dumb-init untuk menangani process (mencegah zombie process dan issue Code: null)
ENTRYPOINT ["dumb-init", "--"]

# Buat direktori dbus sebelum jalankan aplikasi agar Chromium tidak crash
CMD ["sh", "-c", "mkdir -p /run/dbus && dbus-daemon --system --fork || true && cd server && npx prisma db push --accept-data-loss && node index.js"]
