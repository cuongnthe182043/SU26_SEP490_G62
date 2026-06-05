const pool = require('../config/database');

const recordCashPayment = async ({ shipmentId, amount, collectedBy, notes }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const payResult = await client.query(
            `INSERT INTO shipment_payments
                 (shipment_id, payment_type, amount, collected_by, notes, collected_at)
             VALUES ($1, 'cash_collected', $2, $3, $4, NOW())
             RETURNING *`,
            [shipmentId, amount, collectedBy, notes ?? null],
        );
        const payment = payResult.rows[0];

        // Lấy order_id từ shipment
        const osRes = await client.query(
            `SELECT order_id FROM order_shipments WHERE id = $1`,
            [shipmentId],
        );
        const orderId = osRes.rows[0]?.order_id ?? null;

        // Tạo driver debt: driver đã thu tiền nhưng chưa nộp về công ty (§15 TH2, §16)
        const debtRes = await client.query(
            `INSERT INTO debts
                 (debt_type, driver_id, shipment_id, order_id, total_amount, status)
             VALUES ('driver', $1, $2, $3, $4, 'unpaid')
             RETURNING *`,
            [collectedBy, shipmentId, orderId, amount],
        );

        await client.query('COMMIT');
        return { payment, debt: debtRes.rows[0] };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const addPaymentReceipt = async (paymentId, fileUrl) => {
    const result = await pool.query(
        `INSERT INTO payment_receipts (payment_id, file_url)
         VALUES ($1, $2)
         RETURNING *`,
        [paymentId, fileUrl],
    );
    return result.rows[0];
};

const getShipmentPayments = async (shipmentId) => {
    const result = await pool.query(
        `SELECT
            sp.id,
            sp.shipment_id,
            sp.payment_type,
            sp.amount::text,
            sp.notes,
            sp.collected_at,
            COALESCE(
                json_agg(pr.file_url ORDER BY pr.uploaded_at)
                FILTER (WHERE pr.id IS NOT NULL),
                '[]'::json
            ) AS receipt_urls
         FROM shipment_payments sp
         LEFT JOIN payment_receipts pr ON pr.payment_id = sp.id
         WHERE sp.shipment_id = $1
         GROUP BY sp.id
         ORDER BY sp.collected_at ASC`,
        [shipmentId],
    );
    return result.rows;
};

module.exports = { recordCashPayment, addPaymentReceipt, getShipmentPayments };
