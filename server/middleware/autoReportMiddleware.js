const { logDailyActivity } = require('../utils/autoReport');

const autoReportMiddleware = (req, res, next) => {
    // Save original send to intercept the response if needed, 
    // but just listening to 'finish' is usually enough to know if it succeeded.
    res.on('finish', () => {
        // Only log if user is authenticated, method is modifying, and request was successful
        if (req.user && ['POST', 'PUT', 'DELETE'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
            
            // Skip the laporan API itself to avoid loops or redundant logs
            if (req.originalUrl.includes('/api/laporan')) return;
            
            const url = req.originalUrl;
            let category = 'UMUM';
            let target = 'data';
            let shouldLog = false;
            
            if (url.includes('/api/assets') || url.includes('/api/aset')) { 
                category = 'ASET'; target = 'aset'; shouldLog = true;
            }
            else if (url.includes('/api/warehouse') || url.includes('/api/uniforms')) { 
                category = 'GUDANG'; target = 'barang/gudang'; shouldLog = true; 
            }
            else if (url.includes('/api/vehicles') || url.includes('/api/vehicle')) { 
                category = 'KENDARAAN'; target = 'kendaraan'; shouldLog = true; 
            }
            else if (url.includes('/api/maintenance')) { 
                category = 'UMUM'; target = 'pemeliharaan'; shouldLog = true; 
            }
            else if (url.includes('/api/e-office') || url.includes('/api/office-documents')) {
                category = 'KEUANGAN'; target = 'dokumen e-office'; shouldLog = true;
            }
            else if (url.includes('/api/bus-bookings')) {
                // Only log scheduling (creating) and bus/driver assignment
                if (req.method === 'POST' && (url.match(/\/api\/bus-bookings\/?$/) || url.match(/\/api\/bus-bookings\/public\/?$/))) {
                    category = 'KENDARAAN'; target = 'jadwal pemesanan bus'; shouldLog = true;
                } else if (req.method === 'PUT' && url.includes('/assign-driver')) {
                    category = 'KENDARAAN'; target = 'penugasan bus & sopir'; shouldLog = true;
                }
            }

            if (shouldLog) {
                let action = 'Memanipulasi';
                if (req.method === 'POST') action = 'Menambah/Membuat';
                if (req.method === 'PUT') action = 'Memperbarui';
                if (req.method === 'DELETE') action = 'Menghapus';

                // Try to extract a name or title for better context
                let itemContext = '';
                if (req.body && typeof req.body === 'object') {
                    if (req.body.name) itemContext = ` "${req.body.name}"`;
                    else if (req.body.title) itemContext = ` "${req.body.title}"`;
                    else if (req.body.code) itemContext = ` "${req.body.code}"`;
                }

                const activityMsg = `${action} ${target}${itemContext} (Rute: ${url})`;
                logDailyActivity(req.user.id, category, activityMsg);
            }
        }
    });
    
    next();
};

module.exports = autoReportMiddleware;
