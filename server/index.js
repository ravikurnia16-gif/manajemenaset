const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

const path = require('path');

app.use(cors());
app.use(express.json());

// Routes API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));

// --- BAGIAN DEPLOYMENT: Melayani File Tampilan (Frontend) ---
// Pastikan path ke folder 'dist' benar (relatif dari server/index.js)
const distPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(distPath));

// --- CATCH-ALL MIDDLEWARE ---
// Menggunakan app.use di akhir untuk menangani semua request yang tidak cocok dengan route API
app.use((req, res) => {
    // Jika bukan API, kirim index.html (React Router akan menangani routing di sisi client)
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'), (err) => {
            if (err) {
                console.error("Build frontend tidak ditemukan di:", distPath);
                res.status(500).send("Error: Frontend build not found. Pastikan folder 'client/dist' sudah ada.");
            }
        });
    } else {
        res.status(404).json({ message: 'API Route Not Found' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
