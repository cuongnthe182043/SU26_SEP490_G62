const accountantFinanceService = require('../../services/accountant/accountantFinanceService');

const getFinanceStats = async (req, res) => {
    try {
        const stats = await accountantFinanceService.getFinanceStats();
        res.json(stats);
    } catch (err) {
        console.error('Error fetching finance stats:', err);
        res.status(500).json({ error: 'Failed to load financial statistics', details: err.message });
    }
};

module.exports = {
    getFinanceStats,
};
