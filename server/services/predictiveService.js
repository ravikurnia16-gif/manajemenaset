const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Predict the next maintenance date based on historical data.
 * Calculation: Average interval between previous completion dates.
 * @param {number} assetId - The ID of the asset to analyze
 * @returns {Promise<Object>} - Predicted maintenance data
 */
exports.predictNextMaintenance = async (assetId) => {
    try {
        // 0. Fetch Asset Config
        const asset = await prisma.asset.findUnique({
            where: { id: assetId }
        });

        if (!asset) return null;

        // 1. Fetch historical maintenance data for this asset
        const history = await prisma.maintenance.findMany({
            where: {
                assets: { some: { id: assetId } },
                status: 'COMPLETED',
                completionDate: { not: null }
            },
            orderBy: { completionDate: 'desc' },
            take: 10 // Analyze last 10 records
        });

        let maintenanceInterval = asset.maintenanceInterval;
        let lastCompletion = history.length > 0 ? new Date(history[0].completionDate) : new Date();

        if (asset.needsRoutineMaintenance) {
            // Priority 1: Use Manual Interval (default to 180 if marked routine but no interval set)
            maintenanceInterval = asset.maintenanceInterval || 180;
        } else if (history.length >= 2) {
            // Priority 2: Use AI Calculation (Average from history)
            let totalDays = 0;
            let count = 0;

            for (let i = 0; i < history.length - 1; i++) {
                const current = new Date(history[i].completionDate);
                const prev = new Date(history[i + 1].completionDate);
                const diffTime = Math.abs(current - prev);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > 7 && diffDays < 730) {
                    totalDays += diffDays;
                    count++;
                }
            }
            if (count > 0) maintenanceInterval = Math.round(totalDays / count);
        } else {
            // Priority 3: No routine flag and no history -> No estimation
            maintenanceInterval = null;
        }

        // 3. Estimate next date
        let nextDate = null;
        if (maintenanceInterval) {
            nextDate = new Date(lastCompletion);
            nextDate.setDate(lastCompletion.getDate() + maintenanceInterval);
        }

        // 4. Update the Asset record
        await prisma.asset.update({
            where: { id: assetId },
            data: {
                nextMaintenanceEst: nextDate,
                maintenanceInterval: maintenanceInterval
            }
        });

        return {
            nextDate,
            interval: maintenanceInterval,
            confidence: asset.needsRoutineMaintenance ? "HIGH (MANUAL)" : (history.length > 5 ? "HIGH" : "MEDIUM"),
            lastMaintenance: history.length > 0 ? history[0].completionDate : null
        };
    } catch (error) {
        console.error("Predictive Service Error:", error);
        return null;
    }
};

/**
 * Get all assets that are due for maintenance soon.
 */
exports.getDueSoonAssets = async (daysThreshold = 14) => {
    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

        return await prisma.asset.findMany({
            where: {
                nextMaintenanceEst: {
                    lte: thresholdDate,
                    gte: new Date() // Still in the future or today
                },
                condition: { not: 'DISPOSED' }
            },
            include: {
                unit: true,
                category: true
            },
            take: 10
        });
    } catch (error) {
        console.error("Get Due Soon Error:", error);
        return [];
    }
};
