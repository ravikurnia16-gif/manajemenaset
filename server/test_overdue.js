require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { checkOverdueLoans } = require('./controllers/loanController');

async function test() {
    console.log('--- Testing Overdue Loan Notifications ---');

    // 1. Ensure we have an overdue loan for testing
    // Search for a BORROWED loan
    let loan = await prisma.assetLoan.findFirst({
        where: { status: 'BORROWED' },
        include: { borrower: true }
    });

    if (!loan) {
        console.log('No BORROWED loan found. Please borrow an asset first or update a loan status manually.');
        process.exit(0);
    }

    console.log(`Found loan for ${loan.borrower.name}. Temporary setting its expectedReturnDate to yesterday...`);
    const originalDate = loan.expectedReturnDate;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.assetLoan.update({
        where: { id: loan.id },
        data: { expectedReturnDate: yesterday }
    });

    try {
        // 2. Trigger the check
        await checkOverdueLoans();
        console.log('Check finished. Verify your terminal logs for WA sending messages (or check DB logs if implemented).');
    } finally {
        // 3. Restore the date
        await prisma.assetLoan.update({
            where: { id: loan.id },
            data: { expectedReturnDate: originalDate }
        });
        console.log('Restored original return date.');
    }
}

test().then(() => prisma.$disconnect());
