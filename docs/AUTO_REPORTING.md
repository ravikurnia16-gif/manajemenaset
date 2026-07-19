# Dokumentasi Sistem Laporan Harian Otomatis (Auto-Reporting) & Role Access

Dokumen ini menjelaskan arsitektur dan cara kerja fitur Laporan Harian Staf yang diimplementasikan untuk memudahkan pencatatan aktivitas keseharian staf.

## 1. Pemisahan Hak Akses (Role Access) di Frontend

Menu Laporan dipecah berdasarkan jabatan (`position`) pengguna yang sedang masuk (*login*). 
File yang mengatur logika ini adalah `client/src/components/Sidebar.jsx`.

**Kategori Laporan:**
- **Laporan Gudang**: Muncul jika posisi mengandung kata `gudang` atau `logistik`.
- **Laporan Aset**: Muncul jika posisi mengandung kata `aset`.
- **Laporan Pemeliharaan**: Muncul jika posisi mengandung kata `teknisi`.
- **Laporan Kendaraan**: Muncul jika posisi mengandung kata `kendaraan`.
- **Laporan Keuangan & Admin**: Muncul jika posisi mengandung kata `administrasi` atau `keuangan`.
- **Hak Akses Khusus**: `SUPER_ADMIN` dan `KABID_SARPRAS` dapat melihat semua menu laporan.

Rute yang digunakan adalah `/laporan/:category` yang akan memuat komponen `LaporanStaff.jsx`.

## 2. Middleware Laporan Otomatis (Backend)

Sistem menggunakan sebuah *middleware* global di backend untuk mendeteksi setiap kali ada data yang ditambah, diubah, atau dihapus oleh pengguna.
File utama: `server/middleware/autoReportMiddleware.js`

**Cara Kerja Middleware:**
1. Mencegat semua request dengan metode `POST`, `PUT`, atau `DELETE`.
2. Mengecek apakah status kode respons berhasil (200 - 299).
3. Membaca `req.originalUrl` untuk menentukan kategori tindakan (misal: `/api/warehouse` akan dikategorikan sebagai aksi di `GUDANG`).
4. Mencoba mengambil nama entitas yang dimanipulasi melalui `req.body.name`, `req.body.title`, atau `req.body.code`.
5. Memanggil fungsi `logDailyActivity` untuk mencatat string laporan otomatis, misal: `[15:30] (Otomatis) Menambah/Membuat barang/gudang "Laptop" (Rute: /api/warehouse)`.

> **Catatan untuk Developer Selanjutnya:**
> Jika Anda menambahkan rute API baru (misalnya `/api/buku`) dan ingin rute tersebut otomatis masuk ke laporan harian staf, Anda cukup menambahkan kondisi rute tersebut di dalam `server/middleware/autoReportMiddleware.js`.

## 3. Struktur Data Laporan (PersonnelReport)

Tabel yang digunakan di database (Prisma) adalah `PersonnelReport`.

Kolom yang relevan untuk fitur ini:
- `userId`: Relasi ke staf yang melakukan aksi.
- `type`: Diset sebagai `DAILY`.
- `category`: `UMUM`, `ASET`, `GUDANG`, `KENDARAAN`, atau `KEUANGAN`.
- `content`: (String) Digunakan khusus untuk menampung **catatan aktivitas otomatis** yang dihasilkan oleh middleware, dipisahkan oleh *newline* (`\n`).
- `metadata`: (JSON) Digunakan untuk menyimpan **laporan poin manual** staf dalam format struktur `manualPoints` (Array of Strings). 
  *Contoh:* `{"manualPoints": ["Merapikan ruang arsip", "Rapat internal"]}`
- `date`: Tanggal laporan (untuk mempermudah filter).

## 4. Antarmuka Pengguna (LaporanStaff.jsx)

Komponen ini bersifat dinamis:
- Menerima argumen kategori dari URL, misal `/laporan/gudang`.
- Menampilkan log otomatis (*content*) dengan status hanya-baca (Read-Only).
- Memungkinkan pengguna menambah/menghapus catatan aktivitas manual melalui state array `manualPoints`.
- Bebas memilih tanggal mundur atau maju untuk melengkapi laporan manual yang tertinggal.
- Khusus untuk akun dengan hak akses `isAdmin` (seperti Admin Aset, IT, Super Admin), tampilan sebelah kanan akan memperlihatkan **Rekap Laporan Tim**, yang menarik data semua staf untuk kategori terkait pada tanggal tersebut.
