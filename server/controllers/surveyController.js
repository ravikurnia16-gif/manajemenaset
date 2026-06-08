const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. PUBLIC: Get all active survey questions
exports.getActiveQuestions = async (req, res) => {
    try {
        const setting = await prisma.setting.findUnique({ where: { id: 1 } });
        if (!setting || !setting.surveyEnabled) {
            return res.status(403).json({ error: "Survey sedang dinonaktifkan." });
        }

        const questions = await prisma.surveyQuestion.findMany({
            where: { isActive: true },
            orderBy: { id: 'asc' }
        });
        res.json(questions);
    } catch (error) {
        console.error("Get active questions error:", error);
        res.status(500).json({ error: "Gagal mengambil pertanyaan survey." });
    }
};

// 2. PUBLIC: Submit survey response
exports.submitSurvey = async (req, res) => {
    try {
        const setting = await prisma.setting.findUnique({ where: { id: 1 } });
        if (!setting || !setting.surveyEnabled) {
            return res.status(403).json({ error: "Survey sedang dinonaktifkan." });
        }

        const { respondentName, respondentUnit, feedback, answers } = req.body;

        if (!answers || answers.length === 0) {
            return res.status(400).json({ error: "Tidak ada jawaban yang dikirim." });
        }

        // Create Response and Answers in a transaction
        const response = await prisma.surveyResponse.create({
            data: {
                respondentName,
                respondentUnit,
                feedback,
                answers: {
                    create: answers.map(ans => ({
                        questionId: ans.questionId,
                        ratingValue: ans.ratingValue,
                        textValue: ans.textValue
                    }))
                }
            },
            include: {
                answers: true
            }
        });

        res.status(201).json({ message: "Survey berhasil dikirim", data: response });
    } catch (error) {
        console.error("Submit survey error:", error);
        res.status(500).json({ error: "Gagal mengirim survey." });
    }
};

// 3. ADMIN: Get all questions (active and inactive)
exports.getQuestionsAdmin = async (req, res) => {
    try {
        const questions = await prisma.surveyQuestion.findMany({
            orderBy: { id: 'asc' }
        });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ error: "Gagal mengambil pertanyaan." });
    }
};

// 4. ADMIN: Create new question
exports.createQuestion = async (req, res) => {
    try {
        const { text, type, isActive } = req.body;
        const question = await prisma.surveyQuestion.create({
            data: { text, type, isActive: isActive ?? true }
        });
        res.status(201).json(question);
    } catch (error) {
        res.status(500).json({ error: "Gagal membuat pertanyaan." });
    }
};

// 5. ADMIN: Update question
exports.updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, type, isActive } = req.body;
        const question = await prisma.surveyQuestion.update({
            where: { id: parseInt(id) },
            data: { text, type, isActive }
        });
        res.json(question);
    } catch (error) {
        res.status(500).json({ error: "Gagal memperbarui pertanyaan." });
    }
};

// 6. ADMIN: Delete question
exports.deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.surveyQuestion.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: "Pertanyaan berhasil dihapus." });
    } catch (error) {
        res.status(500).json({ error: "Gagal menghapus pertanyaan." });
    }
};

// 7. ADMIN: Get Survey Stats
exports.getSurveyStats = async (req, res) => {
    try {
        // Total Responses
        const totalResponses = await prisma.surveyResponse.count();

        // Get Average for each RATING question
        const questions = await prisma.surveyQuestion.findMany({
            where: { type: 'RATING' },
            select: { id: true, text: true }
        });

        const stats = await Promise.all(questions.map(async (q) => {
            const aggr = await prisma.surveyAnswer.aggregate({
                where: { questionId: q.id, ratingValue: { not: null } },
                _avg: { ratingValue: true },
                _count: { ratingValue: true }
            });
            return {
                questionId: q.id,
                text: q.text,
                average: aggr._avg.ratingValue || 0,
                count: aggr._count.ratingValue || 0
            };
        }));

        // Get distribution of ratings (how many 5 stars, 4 stars, etc. overall)
        const distribution = await prisma.surveyAnswer.groupBy({
            by: ['ratingValue'],
            where: { ratingValue: { not: null } },
            _count: { ratingValue: true }
        });

        // Get latest text feedbacks from SurveyResponse
        const feedbacks = await prisma.surveyResponse.findMany({
            where: { feedback: { not: null }, feedback: { not: '' } },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { 
                respondentName: true, 
                respondentUnit: true, 
                createdAt: true, 
                feedback: true 
            }
        });

        res.json({
            totalResponses,
            stats,
            distribution,
            feedbacks
        });
    } catch (error) {
        console.error("Get survey stats error:", error);
        res.status(500).json({ error: "Gagal memuat statistik survey." });
    }
};

// 8. ADMIN: Get Raw Responses
exports.getSurveyResponses = async (req, res) => {
    try {
        const responses = await prisma.surveyResponse.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                answers: {
                    include: {
                        question: {
                            select: { text: true, type: true }
                        }
                    }
                }
            }
        });
        res.json(responses);
    } catch (error) {
        res.status(500).json({ error: "Gagal memuat data respons survey." });
    }
};
