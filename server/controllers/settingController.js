const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ID Setting selalu 1
const SETTING_ID = 1;

exports.getSettings = async (req, res) => {
    try {
        let settings = await prisma.setting.findUnique({
            where: { id: SETTING_ID }
        });

        // Jika belum ada, buat default
        if (!settings) {
            settings = await prisma.setting.create({
                data: {
                    id: SETTING_ID,
                    orgName: "Manajemen Aset",
                    assetCodePrefix: "AST"
                }
            });
        }

        res.json(settings);
    } catch (error) {
        console.error("Get settings error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const {
            orgName, orgAddress, orgPhone, orgEmail,
            orgLogo, orgHeadName, orgHeadNip, assetCodePrefix,
            busInitialFund, surveyEnabled
        } = req.body;

        const settings = await prisma.setting.upsert({
            where: { id: SETTING_ID },
            update: {
                orgName, orgAddress, orgPhone, orgEmail,
                orgLogo, orgHeadName, orgHeadNip, assetCodePrefix,
                busInitialFund, surveyEnabled
            },
            create: {
                id: SETTING_ID,
                orgName, orgAddress, orgPhone, orgEmail,
                orgLogo, orgHeadName, orgHeadNip, assetCodePrefix,
                busInitialFund, surveyEnabled
            }
        });

        res.json(settings);
    } catch (error) {
        console.error("Update settings error:", error);
        res.status(500).json({ error: error.message });
    }
};
