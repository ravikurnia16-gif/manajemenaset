const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// 1. PUBLIC: Get the active survey and its questions
exports.getActiveSurvey = async (req, res) => {
    try {
        const now = new Date();
        
        // Find a survey that is active, and current date is within bounds
        const survey = await prisma.survey.findFirst({
            where: {
                isActive: true,
                OR: [
                    { startDate: null, endDate: null },
                    { startDate: { lte: now }, endDate: null },
                    { startDate: null, endDate: { gte: now } },
                    { startDate: { lte: now }, endDate: { gte: now } }
                ]
            },
            include: {
                questions: {
                    where: { isActive: true },
                    orderBy: { order: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!survey) {
            return res.status(403).json({ error: "Survey ditutup atau masa periode telah berakhir." });
        }

        res.json(survey);
    } catch (error) {
        console.error("Get active survey error:", error);
        res.status(500).json({ error: "Gagal mengambil paket survey aktif." });
    }
};

// 2. PUBLIC: Submit survey response
exports.submitSurvey = async (req, res) => {
    try {
        const { surveyId, respondentName, respondentUnit, feedback, answers } = req.body;

        if (!surveyId) return res.status(400).json({ error: "ID Survey tidak valid." });
        if (!answers || answers.length === 0) return res.status(400).json({ error: "Tidak ada jawaban yang dikirim." });

        // Check if survey is still valid
        const now = new Date();
        const survey = await prisma.survey.findUnique({ where: { id: parseInt(surveyId) } });
        if (!survey || !survey.isActive || (survey.endDate && new Date(survey.endDate) < now)) {
            return res.status(403).json({ error: "Periode survey ini sudah berakhir." });
        }

        // Create Response and Answers
        const response = await prisma.surveyResponse.create({
            data: {
                surveyId: parseInt(surveyId),
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
            include: { answers: true }
        });

        res.status(201).json({ message: "Survey berhasil dikirim", data: response });
    } catch (error) {
        console.error("Submit survey error:", error);
        res.status(500).json({ error: "Gagal mengirim survey." });
    }
};


// ==========================================
// ADMIN ROUTES: SURVEY PACKAGES
// ==========================================

// 3. ADMIN: Get all survey packages
exports.getAllSurveys = async (req, res) => {
    try {
        const surveys = await prisma.survey.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { questions: true, responses: true }
                }
            }
        });
        res.json(surveys);
    } catch (error) {
        res.status(500).json({ error: "Gagal memuat daftar survey." });
    }
};

// 4. ADMIN: Create a new survey package
exports.createSurvey = async (req, res) => {
    try {
        const { title, description, startDate, endDate, isActive } = req.body;
        const survey = await prisma.survey.create({
            data: {
                title,
                description,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                isActive: isActive ?? false
            }
        });
        res.status(201).json(survey);
    } catch (error) {
        res.status(500).json({ error: "Gagal membuat paket survey." });
    }
};

// 5. ADMIN: Update a survey package
exports.updateSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, startDate, endDate, isActive } = req.body;
        const survey = await prisma.survey.update({
            where: { id: parseInt(id) },
            data: {
                title,
                description,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                isActive
            }
        });
        res.json(survey);
    } catch (error) {
        res.status(500).json({ error: "Gagal memperbarui paket survey." });
    }
};

// 6. ADMIN: Delete a survey package
exports.deleteSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.survey.delete({ where: { id: parseInt(id) } });
        res.json({ message: "Paket survey dihapus." });
    } catch (error) {
        res.status(500).json({ error: "Gagal menghapus paket survey." });
    }
};

// 7. ADMIN: Duplicate a survey package
exports.duplicateSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Fetch existing survey with questions
        const existingSurvey = await prisma.survey.findUnique({
            where: { id: parseInt(id) },
            include: { questions: true }
        });

        if (!existingSurvey) return res.status(404).json({ error: "Survey tidak ditemukan." });

        // Create new survey with copied questions
        const newSurvey = await prisma.survey.create({
            data: {
                title: `${existingSurvey.title} (Copy)`,
                description: existingSurvey.description,
                startDate: null,
                endDate: null,
                isActive: false,
                questions: {
                    create: existingSurvey.questions.map(q => ({
                        text: q.text,
                        type: q.type,
                        order: q.order,
                        isActive: q.isActive
                    }))
                }
            }
        });

        res.status(201).json(newSurvey);
    } catch (error) {
        console.error("Duplicate survey error:", error);
        res.status(500).json({ error: "Gagal menduplikasi survey." });
    }
};


// ==========================================
// ADMIN ROUTES: SURVEY QUESTIONS
// ==========================================

exports.getQuestionsBySurvey = async (req, res) => {
    try {
        const { surveyId } = req.params;
        const questions = await prisma.surveyQuestion.findMany({
            where: { surveyId: parseInt(surveyId) },
            orderBy: { order: 'asc' }
        });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ error: "Gagal memuat pertanyaan." });
    }
};

exports.createQuestion = async (req, res) => {
    try {
        const { surveyId, text, type, isActive, order } = req.body;
        const question = await prisma.surveyQuestion.create({
            data: { 
                surveyId: parseInt(surveyId),
                text, 
                type, 
                order: order ?? 0,
                isActive: isActive ?? true 
            }
        });
        res.status(201).json(question);
    } catch (error) {
        res.status(500).json({ error: "Gagal membuat pertanyaan." });
    }
};

exports.updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, type, isActive, order } = req.body;
        const question = await prisma.surveyQuestion.update({
            where: { id: parseInt(id) },
            data: { text, type, isActive, order }
        });
        res.json(question);
    } catch (error) {
        res.status(500).json({ error: "Gagal memperbarui pertanyaan." });
    }
};

exports.deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.surveyQuestion.delete({ where: { id: parseInt(id) } });
        res.json({ message: "Pertanyaan dihapus." });
    } catch (error) {
        res.status(500).json({ error: "Gagal menghapus pertanyaan." });
    }
};


// ==========================================
// ADMIN ROUTES: DASHBOARD & STATS
// ==========================================

exports.getSurveyStats = async (req, res) => {
    try {
        const { surveyId } = req.query;
        
        let whereResponse = {};
        let whereAnswer = {};
        
        if (surveyId) {
            whereResponse.surveyId = parseInt(surveyId);
            whereAnswer.question = { surveyId: parseInt(surveyId) };
        }

        // Total Responses
        const totalResponses = await prisma.surveyResponse.count({ where: whereResponse });

        // Get Average for each RATING question
        const questions = await prisma.surveyQuestion.findMany({
            where: surveyId ? { type: 'RATING', surveyId: parseInt(surveyId) } : { type: 'RATING' },
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
            where: { ratingValue: { not: null }, ...whereAnswer },
            _count: { ratingValue: true }
        });

        // Get latest text feedbacks from SurveyResponse
        const feedbacks = await prisma.surveyResponse.findMany({
            where: { feedback: { not: null }, feedback: { not: '' }, ...whereResponse },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { 
                id: true,
                respondentName: true, 
                respondentUnit: true, 
                createdAt: true, 
                feedback: true,
                survey: { select: { title: true } }
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

exports.getSurveyResponses = async (req, res) => {
    try {
        const { surveyId } = req.query;
        let whereClause = surveyId ? { surveyId: parseInt(surveyId) } : {};

        const responses = await prisma.surveyResponse.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                survey: { select: { title: true } },
                answers: {
                    include: {
                        question: { select: { text: true, type: true } }
                    }
                }
            }
        });
        res.json(responses);
    } catch (error) {
        res.status(500).json({ error: "Gagal memuat data respons survey." });
    }
};
