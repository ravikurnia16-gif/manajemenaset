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

        if (history.length < 2) {
            // Need at least 2 records to calculate interval
            return {
                nextDate: null,
                interval: 180, // Default to 6 months
                confidence: "LOW",
                reason: "Insufficient historical data"
            };
        }

        // 2. Calculate average interval (in days)
        let totalDays = 0;
        let count = 0;

        for (let i = 0; i < history.length - 1; i++) {
            const current = new Date(history[i].completionDate);
            const prev = new Date(history[i + 1].completionDate);
            const diffTime = Math.abs(current - prev);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Avoid outliers (very small or very large intervals)
            if (diffDays > 7 && diffDays < 730) {
                totalDays += diffDays;
                count++;
            }
        }

        const avgInterval = count > 0 ? Math.round(totalDays / count) : 180;
        
        // 3. Estimate next date from the last completion
        const lastCompletion = new Date(history[0].completionDate);
        const nextDate = new Date(lastCompletion);
        nextDate.setDate(lastCompletion.getDate() + avgInterval);

        // 4. Update the Asset record
        await prisma.asset.update({
            where: { id: assetId },
            data: {
                nextMaintenanceEst: nextDate,
                maintenanceInterval: avgInterval
            }
        });

        return {
            nextDate,
            interval: avgInterval,
            confidence: history.length > 5 ? "HIGH" : "MEDIUM",
            lastMaintenance: history[0].completionDate
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
