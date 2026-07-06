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

# Install OpenSSL (Penting untuk Prisma) dan dependensi Chromium/Puppeteer
RUN apt-get update -y && apt-get install -y \
    openssl \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 \
    libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
    libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies backend
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

# Jalankan sinkronisasi database lalu jalankan aplikasi
CMD ["sh", "-c", "cd server && npx prisma db push --accept-data-loss && node index.js"]
