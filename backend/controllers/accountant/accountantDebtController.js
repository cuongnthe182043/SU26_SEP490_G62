const accountantDebtRepository = require('../../repositories/accountant/accountantDebtRepository');

const getDebts = async (req, res) => {
    try {
        const {
            debt_type,    // 'customer' | 'driver'
            status,       // 'paid' | 'partial' | 'unpaid'
            customer,
            driver,
            page = 1,
            limit = 20,
        } = req.query;

        const result = await accountantDebtRepository.getAllDebts({
            debtType: debt_type || null,
            status: status || null,
            customerSearch: customer || null,
            driverSearch: driver || null,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
        });

        res.json(result);
    } catch (err) {
        console.error('Error fetching debts:', err);
        res.status(500).json({ error: 'Failed to fetch debts', details: err.message });
    }
};

const getDebtStats = async (req, res) => {
    try {
        const stats = await accountantDebtRepository.getDebtStats();
        res.json(stats);
    } catch (err) {
        console.error('Error fetching debt stats:', err);
        res.status(500).json({ error: 'Failed to fetch debt stats', details: err.message });
    }
};

module.exports = { getDebts, getDebtStats };
