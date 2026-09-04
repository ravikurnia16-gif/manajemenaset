-- ========================================================================
-- SKRIP MIGRASI TABEL SETORAN HAFALAN (MYSQL)
-- Sistem Manajemen Aset & Operasional Sarpras
-- ========================================================================
-- Jalankan skrip ini langsung di phpMyAdmin / DBeaver / MySQL Console server Anda.

CREATE TABLE IF NOT EXISTS `SetoranHafalan` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `tipeSetoran` VARCHAR(191) NOT NULL DEFAULT 'Ziyadah',
  `juz` INT NOT NULL DEFAULT 30,
  `surah` VARCHAR(191) NOT NULL,
  `surahNumber` INT NOT NULL,
  `ayatAwal` INT NOT NULL,
  `ayatAkhir` INT NOT NULL,
  `totalAyat` INT NOT NULL,
  `pembimbing` VARCHAR(191) NULL,
  `nilai` VARCHAR(191) NOT NULL DEFAULT 'Mumtaz',
  `catatan` TEXT NULL,
  `recordedBy` VARCHAR(191) NULL,
  `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `SetoranHafalan_userId_idx` (`userId`),
  INDEX `SetoranHafalan_date_idx` (`date`),
  INDEX `SetoranHafalan_tipeSetoran_idx` (`tipeSetoran`),
  INDEX `SetoranHafalan_juz_idx` (`juz`),
  CONSTRAINT `SetoranHafalan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
