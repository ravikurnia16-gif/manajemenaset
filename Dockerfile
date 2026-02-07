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

# Install OpenSSL (Penting untuk Prisma agar bisa konek Database)
RUN apt-get update -y && apt-get install -y openssl

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
