require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { checkAssignmentDeadlines } = require('./controllers/personnelController');

async function test() {
    console.log('--- Testing Personnel Assignment Deadlines ---');

    // 1. Find an assignment to test (PENDING or IN_PROGRESS)
    const assignment = await prisma.personnelAssignment.findFirst({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        include: { assignee: true }
    });

    if (!assignment) {
        console.log('No PENDING or IN_PROGRESS assignment found. Create one first.');
        process.exit(0);
    }

    console.log(`Testing with assignment: ${assignment.title} (Assignee: ${assignment.assignee?.name})`);
    
    // Save original values
    const originalDueDate = assignment.dueDate;
    const originalLastReminder = assignment.lastReminderSent;

    try {
        // --- Test 1: Upcoming (Tomorrow) ---
        console.log('\n--- Scenario 1: Tomorrow (H-1) ---');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        await prisma.personnelAssignment.update({
            where: { id: assignment.id },
            data: { dueDate: tomorrow, lastReminderSent: null }
        });
        await checkAssignmentDeadlines();

        // --- Test 2: Today ---
        console.log('\n--- Scenario 2: Today ---');
        await prisma.personnelAssignment.update({
            where: { id: assignment.id },
            data: { dueDate: new Date(), lastReminderSent: null }
        });
        await checkAssignmentDeadlines();

        // --- Test 3: Overdue ---
        console.log('\n--- Scenario 3: Overdue ---');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 2);
        await prisma.personnelAssignment.update({
            where: { id: assignment.id },
            data: { dueDate: yesterday, lastReminderSent: null }
        });
        await checkAssignmentDeadlines();

    } finally {
        // Restore
        await prisma.personnelAssignment.update({
            where: { id: assignment.id },
            data: { 
                dueDate: originalDueDate,
                lastReminderSent: originalLastReminder
            }
        });
        console.log('\nRestored original assignment data.');
    }
}

test().then(() => prisma.$disconnect());
