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

# Install dependencies backend
COPY server/package*.json ./server/
# Kita butuh semua deps (termasuk prisma) untuk generate client
RUN cd server && npm install 

# Copy kode server
COPY server/ ./server/
# Ambil hasil build frontend dari Stage 1
COPY --from=build-stage /app/client/dist ./client/dist

# Generate Prisma Client (Penting agar Database terhubung)
RUN cd server && npx prisma generate

# Easypanel biasanya menggunakan port 5000 atau 3000
EXPOSE 5000

# Jalankan aplikasi
CMD ["node", "server/index.js"]
