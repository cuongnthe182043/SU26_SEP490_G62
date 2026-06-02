const pool = require('../config/database');

const createExpense = async ({ shipmentId, vehicleId, driverId, expenseType, amount, description }) => {
    const result = await pool.query(
        `INSERT INTO expenses (shipment_id, vehicle_id, created_by, expense_type, amount, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [shipmentId, vehicleId ?? null, driverId, expenseType, amount, description ?? null],
    );
    return result.rows[0];
};

const addExpenseAttachment = async (expenseId, fileUrl) => {
    const result = await pool.query(
        `INSERT INTO expense_attachments (expense_id, file_url)
         VALUES ($1, $2)
         RETURNING *`,
        [expenseId, fileUrl],
    );
    return result.rows[0];
};

const getShipmentExpenses = async (shipmentId) => {
    const result = await pool.query(
        `SELECT
            e.id,
            e.shipment_id,
            e.expense_type,
            e.amount::text,
            e.description,
            e.expense_date,
            e.created_at,
            COALESCE(
                json_agg(ea.file_url ORDER BY ea.uploaded_at)
                FILTER (WHERE ea.id IS NOT NULL),
                '[]'::json
            ) AS receipt_urls
         FROM expenses e
         LEFT JOIN expense_attachments ea ON ea.expense_id = e.id
         WHERE e.shipment_id = $1
         GROUP BY e.id
         ORDER BY e.created_at ASC`,
        [shipmentId],
    );
    return result.rows;
};

module.exports = { createExpense, addExpenseAttachment, getShipmentExpenses };
