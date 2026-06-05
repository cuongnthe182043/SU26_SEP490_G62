const pool = require('../../config/database');

const getFinanceStats = async () => {
    const query = `
        SELECT 
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(SUM(paid_amount), 0) as total_collected,
            COALESCE(SUM(total_amount - paid_amount), 0) as total_receivables,
            COUNT(CASE WHEN status != 'paid' THEN 1 END) as pending_payments_count
        FROM debts
        WHERE debt_type = 'customer'
    `;
    const result = await pool.query(query);
    return result.rows[0];
};

module.exports = {
    getFinanceStats,
};
