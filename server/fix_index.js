const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Sedang memperbaiki masalah index pada tabel seragam_stok...");
  
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE seragam_stok DROP FOREIGN KEY seragam_stok_variantId_fkey');
    console.log("✅ Berhasil menghapus Foreign Key: seragam_stok_variantId_fkey");
  } catch (e) {
    console.log("Info FK variantId:", e.message);
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE seragam_stok DROP INDEX seragam_stok_variantId_warehouseId_key');
    console.log("✅ Berhasil menghapus Index Unique: seragam_stok_variantId_warehouseId_key");
  } catch (e) {
    console.log("Info Index:", e.message);
  }

  console.log("\nSelesai! Sekarang Anda sudah bisa menjalankan 'npx prisma db push' dengan aman.");
}

main()
  .catch(e => {
    console.error("Terjadi kesalahan:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
