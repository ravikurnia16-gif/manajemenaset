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

const compression = require('compression');
const path = require('path');

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
app.use('/api/vehicle-inspections', require('./routes/vehicleInspectionRoutes'));
app.use('/api/push', require('./routes/pushRoutes'));
app.use('/api/office-documents', require('./routes/officeDocumentRoutes'));
app.use('/api/asset-standards', require('./routes/assetStandardRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));
app.use('/api/construction', require('./routes/constructionRoutes'));
app.use('/api/contractors', require('./routes/contractorRoutes'));
app.use('/api/workshop', require('./routes/workshopRoutes'));
app.use('/api/surveys', require('./routes/surveyRoutes'));
app.use('/api/vehicle-checklists', require('./routes/vehicleChecklistRoutes'));


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
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'API Route Not Found' });
    }

    // Cegah file statis dari pengembalian index.html (solusi untuk crash saat refresh di nested route web karena base path './')
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webmanifest)$/)) {
        // Jika file diminta dari nested route (misal /kendaraan/assets/file.js)
        if (req.path.includes('/assets/')) {
            const filename = req.path.split('/').pop();
            return res.sendFile(path.join(distPath, 'assets', filename));
        }
        
        // Handle root level assets like Sarpras.jpeg or favicon.ico requested from nested routes
        const rootFilename = req.path.split('/').pop();
        const rootFilePath = path.join(distPath, rootFilename);
        if (require('fs').existsSync(rootFilePath)) {
            return res.sendFile(rootFilePath);
        }

        return res.status(404).send('Not Found');
    }

    // Jika bukan API dan bukan static file, kirim index.html (React Router)
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
            console.error("Build frontend tidak ditemukan di:", distPath);
            res.status(500).send("Error: Frontend build not found. Pastikan folder 'client/dist' sudah ada.");
        }
    });
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
