const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

// Set Global Timezone to WIB (GMT+7)
process.env.TZ = 'Asia/Jakarta';

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
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/master', require('./routes/masterRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/rkb', require('./routes/rkbRoutes'));
app.use('/api/procurements', require('./routes/procurementRoutes'));
app.use('/api/maintenance', require('./routes/maintenanceRoutes'));
app.use('/api/warehouse', require('./routes/warehouseRoutes'));
app.use('/api/uniform-order', require('./routes/uniformOrderRoutes'));
app.use('/api/bus-bookings', require('./routes/busBookingRoutes')); // Added bus booking routes
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/personnel', require('./routes/personnelRoutes'));
app.use('/api/disposals', require('./routes/disposalRoutes'));
app.use('/api/sarpras-rules', require('./routes/sarprasRuleRoutes'));
app.use('/api/sarpras-folders', require('./routes/sarprasFolderRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/loans', require('./routes/loanRoutes'));
app.use('/api/vendors', require('./routes/vendorRoutes'));
app.use('/api/official-residence', require('./routes/officialResidenceRoutes'));
app.use('/api/media', require('./routes/mediaRoutes'));

// Serve Static Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

    // Run vehicle notifications on start
    // Initialize Scheduler for Cron Jobs (Reminders, Summaries, Checks)
    try {
        const { initScheduler } = require('./utils/scheduler');
        initScheduler();
    } catch (e) {
        console.error('Failed to initialize scheduler:', e.message);
    }
});
