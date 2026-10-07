-- ========================================================================
-- SKRIP MIGRASI PENAMBAHAN WEWENANG DRIVER (KAPABILITAS MOBIL & BUS)
-- Sistem Manajemen Aset & Operasional Sarpras
-- ========================================================================
-- Jalankan skrip ini langsung di phpMyAdmin / DBeaver / MySQL Console server Anda.

ALTER TABLE `User` ADD COLUMN `canDriveBus` TINYINT(1) NOT NULL DEFAULT 0;
