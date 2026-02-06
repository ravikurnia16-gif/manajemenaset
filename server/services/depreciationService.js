/**
 * Calculate Straight Line Depreciation
 * @param {number} price - Initial cost
 * @param {number} residualValue - Scrap value
 * @param {number} usefulLifeYears - Life in years
 * @returns {Array} Schedule
 */
exports.calculateStraightLine = (price, residualValue, usefulLifeYears) => {
    const depreciationPerYear = (price - residualValue) / usefulLifeYears;
    const schedule = [];
    let currentBookValue = price;

    for (let i = 1; i <= usefulLifeYears; i++) {
        currentBookValue -= depreciationPerYear;
        schedule.push({
            year: i,
            depreciationAmount: depreciationPerYear,
            accumulatedDepreciation: depreciationPerYear * i,
            bookValue: Math.max(0, currentBookValue)
        });
    }
    return schedule;
};

/**
 * Calculate Declining Balance Depreciation (Double Declining)
 * @param {number} price 
 * @param {number} usefulLifeYears 
 */
exports.calculateDecliningBalance = (price, usefulLifeYears) => {
    // Rate usually 2 / life for double declining
    const rate = 2 / usefulLifeYears;
    const schedule = [];
    let currentBookValue = price;

    for (let i = 1; i <= usefulLifeYears; i++) {
        const depreciationAmount = currentBookValue * rate;

        let amount = depreciationAmount;
        // For last year or precise accounting, adjustments might be needed
        // This is a simplified Double Declining Balance

        currentBookValue -= amount;
        if (currentBookValue < 0) {
            amount += currentBookValue; // Adjust over-depreciation
            currentBookValue = 0;
        }

        schedule.push({
            year: i,
            depreciationAmount: amount,
            bookValue: Math.max(0, currentBookValue)
        });

        if (currentBookValue <= 0) break;
    }
    return schedule;
}
