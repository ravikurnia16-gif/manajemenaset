const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');
const fs = require('fs');

async function main() {
    const filePath = process.argv[2];
    if (!filePath || !fs.existsSync(filePath)) {
        console.error('Silakan berikan path ke file excel, contoh: node fix_import.js data.xlsx');
        process.exit(1);
    }

    console.log(`Membaca file: ${filePath}`);
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length < 2) {
        console.log('File kosong');
        process.exit(0);
    }

    const headerRow = rows[0].map(h => String(h || '').trim().toLowerCase());
    
    const getCol = (names) => {
        for (const name of names) {
            const idx = headerRow.findIndex(h => h === name.toLowerCase());
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const idxNama = getCol(['nama', 'nama barang']);
    const idxKategori = getCol(['kategori', 'kategoriid']);
    const idxTipe = getCol(['tipe', 'type']);
    const idxGender = getCol(['gender', 'jenis kelamin']);
    const idxUkuran = getCol(['ukuran', 'size']);
    const idxUnit = getCol(['unit', 'satuan']);
    const idxStok = getCol(['stok', 'stock']);

    if (idxNama === -1) {
        console.error('Kolom Nama tidak ditemukan di file Excel.');
        process.exit(1);
    }

    const dataRows = rows.slice(1).filter(r => r[idxNama] && !String(r[idxNama]).startsWith('#'));

    const normalizeGender = (val) => {
        if (!val) return null;
        const v = String(val).trim().toLowerCase();
        if (['p', 'perempuan', 'akhwat', 'akhowat', 'wanita'].includes(v)) return 'P';
        if (['l', 'laki-laki', 'ikhwan', 'pria'].includes(v)) return 'L';
        return null;
    };

    let totalFixed = 0;

    for (const cols of dataRows) {
        const rawCategory = idxKategori !== -1 ? String(cols[idxKategori] || '').trim() : '';
        let catId = parseInt(rawCategory);

        if (isNaN(catId) && rawCategory) {
            let category = await prisma.warehouseCategory.findFirst({
                where: { name: rawCategory }
            });
            if (!category) {
                const allCats = await prisma.warehouseCategory.findMany();
                category = allCats.find(c => c.name.toLowerCase() === rawCategory.toLowerCase());
            }
            if (category) {
                catId = category.id;
            }
        }

        const name = String(cols[idxNama] || '').trim();
        const type = idxTipe !== -1 ? String(cols[idxTipe] || '').trim() : null;
        
        let rawGender = null;
        if (idxGender !== -1) {
            const g = String(cols[idxGender] || '').trim().toLowerCase();
            if (g) {
                if (['l', 'ikhwan', 'laki-laki'].includes(g)) rawGender = 'L';
                else if (['p', 'akhwat', 'perempuan'].includes(g)) rawGender = 'P';
                else rawGender = String(cols[idxGender]).trim();
            }
        }
        
        const gender = normalizeGender(rawGender);
        const size = idxUkuran !== -1 ? String(cols[idxUkuran] || '').trim() : null;
        const itemUnit = idxUnit !== -1 ? String(cols[idxUnit] || '').trim() : null;
        const stockToSubtract = idxStok !== -1 ? parseInt(cols[idxStok]) || 0 : 0;

        if (stockToSubtract <= 0) continue;

        // Simulasikan BUG sebelumnya: mencari item TANPA memperdulikan purchaseYear
        // Ini akan secara persis menemukan item tahun 2023 yang kemarin salah bertambah stoknya
        const existingItem = await prisma.warehouseItem.findFirst({
            where: { 
                name: name,
                categoryId: isNaN(catId) ? undefined : catId,
                gender: gender,
                size: size || null,
                type: type || null,
                itemUnit: itemUnit || null
            }
        });

        if (existingItem) {
            await prisma.warehouseItem.update({
                where: { id: existingItem.id },
                data: { stock: { decrement: stockToSubtract } }
            });
            console.log(`[DIKURANGI] ${name} (Size: ${size || '-'}) - Dikurangi ${stockToSubtract}. (Sisa Stok: ${existingItem.stock - stockToSubtract})`);
            totalFixed++;
        } else {
            console.log(`[SKIP] ${name} (Size: ${size || '-'}) - Tidak ditemukan item yang terpengaruh.`);
        }
    }
    
    console.log(`\nSelesai! Berhasil memulihkan/mengurangi stok pada ${totalFixed} baris barang.`);
    process.exit(0);
}

main().catch(console.error);
