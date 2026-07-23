const chatbotService = require('../services/chatbotService');

const getStatus = (req, res) => {
    res.json({ enabled: chatbotService.isChatbotEnabled() });
};

const ask = async (req, res) => {
    try {
        const { question, history } = req.body || {};
        const result = await chatbotService.ask({
            role: req.user.role,
            actorId: req.user.userId,
            question,
            history: Array.isArray(history) ? history : [],
        });
        res.json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        if (status >= 500) console.error('[chatbot] lỗi:', err.message);
        res.status(status).json({ error: err.message });
    }
};

module.exports = { getStatus, ask };
