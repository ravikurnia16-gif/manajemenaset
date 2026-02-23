require('dotenv').config();
const axios = require('axios');

async function test() {
    console.log('--- Testing Asset Import Category Validation ---');

    // Note: This requires the server to be running and valid credentials.
    // Instead of a full API call, this script is for manual inspection of the logic
    // OR I can use prisma directly to simulate the controller function logic.

    const { batchImportAssets } = require('./controllers/assetController');

    // Mocking req/res
    const req = {
        body: [
            {
                'Nama Aset': 'Test Aset Validasi',
                'Merek Aset': 'Test',
                'Vendor Aset': 'Test Vendor',
                'Umur Ekonomis Aset(tahun)': 5,
                'Kondisi Aset': 'BAIK',
                'Sumber Dana Aset': 'Mandiri',
                'Ruangan Aset': 'R. TEST',
                'Unit Aset': 'KANTOR YAYASAN', // Assuming this exists
                'Kategori': 'KATEGORI_PALSU_123', // This should FAIL
                'Tanggal Transaksi Masuk (yyyy-mm-dd)': '2024-01-01',
                'Jenis Transaksi Masuk': 'Beli',
                'Harga Perolehan': 1000000
            }
        ],
        user: { id: 1 }
    };

    const res = {
        status: (code) => ({
            json: (data) => {
                console.log(`Response Code: ${code}`);
                console.log('Response Data:', data);
            }
        }),
        json: (data) => {
            console.log('Response Data (Success):', data);
        }
    };

    console.log('Running batchImportAssets with invalid category...');
    await batchImportAssets(req, res);
}

test();
