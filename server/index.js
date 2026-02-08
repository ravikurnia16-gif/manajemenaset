const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

const path = require('path');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/master', require('./routes/masterRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));

// Health Check untuk memastikan API & DB aman
app.get('/api/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'OK', database: 'Connected' });
    } catch (error) {
        res.status(500).json({ status: 'Error', database: 'Disconnected', error: error.message });
    }
});

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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server successfully started!`);
    console.log(`   - Port: ${PORT}`);
    console.log(`   - Interface: 0.0.0.0`);
    console.log(`   - Frontend Path: ${distPath}`);
});
