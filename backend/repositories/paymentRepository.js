const pool = require('../config/database');

/**
 * Get payment history for a specific order
 */
const getPaymentsByOrderId = async (orderId) => {
    const query = `
        SELECT p.*, pr.full_name as creator_name
        FROM debt_payments p
        JOIN debts d ON p.debt_id = d.id
        LEFT JOIN profiles pr ON p.created_by = pr.id
        WHERE d.order_id = $1
        ORDER BY p.paid_at DESC
    `;
    const result = await pool.query(query, [orderId]);
    return result.rows;
};

/**
 * Record a payment for an order and update debt status
 */
const recordPayment = async (orderId, { amount, paymentMethod, notes, createdBy }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get the debt record for the order
        let debtResult = await client.query('SELECT * FROM debts WHERE order_id = $1', [orderId]);
        let debt;

        if (debtResult.rows.length === 0) {
            // Fallback: If for some reason debt didn't get created, create it now
            const orderResult = await client.query('SELECT customer_id, estimated_price FROM orders WHERE id = $1', [orderId]);
            if (orderResult.rows.length === 0) {
                throw new Error(`Order #${orderId} not found`);
            }
            const order = orderResult.rows[0];

            const insertDebt = await client.query(
                `INSERT INTO debts (debt_type, customer_id, order_id, total_amount, paid_amount, due_date, status, notes, updated_by)
                 VALUES ('customer', $1, $2, $3, 0, CURRENT_DATE + INTERVAL '30 days', 'unpaid', $4, $5) RETURNING *`,
                [order.customer_id, orderId, order.estimated_price || 0, `Khởi tạo công nợ thủ công cho đơn hàng #${orderId + 8800}`, createdBy]
            );
            debt = insertDebt.rows[0];
        } else {
            debt = debtResult.rows[0];
        }

        const numericAmount = Number(amount);
        const newPaidAmount = Number(debt.paid_amount) + numericAmount;
        const totalAmount = Number(debt.total_amount);

        // Validate that payment does not exceed remaining debt (BR-20: Payments may not exceed the remaining debt amount)
        const remainingDebt = totalAmount - Number(debt.paid_amount);
        if (numericAmount > remainingDebt + 0.01) { // 0.01 tolerance for floating point inaccuracy
            throw new Error(`Số tiền thanh toán (${numericAmount.toLocaleString()}đ) vượt quá dư nợ còn lại (${remainingDebt.toLocaleString()}đ)`);
        }

        // 2. Insert payment record into debt_payments
        const paymentQuery = `
            INSERT INTO debt_payments (debt_id, amount, payment_method, paid_at, created_by, notes)
            VALUES ($1, $2, $3, NOW(), $4, $5)
            RETURNING *
        `;
        const paymentResult = await client.query(paymentQuery, [
            debt.id,
            numericAmount,
            paymentMethod || 'cash',
            createdBy,
            notes || ''
        ]);

        // 3. Update debt status based on new paid amount
        let newStatus = 'unpaid';
        if (newPaidAmount >= totalAmount - 0.01) {
            newStatus = 'paid';
        } else if (newPaidAmount > 0) {
            newStatus = 'partial';
        }

        await client.query(
            `UPDATE debts 
             SET paid_amount = $1, status = $2, updated_by = $3, notes = $4 
             WHERE id = $5`,
            [newPaidAmount, newStatus, createdBy, `Cập nhật thanh toán: Đã thu ${newPaidAmount.toLocaleString()}đ`, debt.id]
        );

        // 4. Update customer debt if payment type is 'client_credit' or 'debt'
        const orderResult = await client.query('SELECT payment_type, customer_id FROM orders WHERE id = $1', [orderId]);
        if (orderResult.rows.length > 0 && (orderResult.rows[0].payment_type === 'debt' || orderResult.rows[0].payment_type === 'client_credit')) {
            const customerId = orderResult.rows[0].customer_id;
            await client.query(
                `UPDATE customers 
                 SET current_debt = GREATEST(0, current_debt - $1) 
                 WHERE id = $2`,
                [numericAmount, customerId]
            );
        }

        await client.query('COMMIT');
        return {
            payment: paymentResult.rows[0],
            newPaidAmount,
            newStatus
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/**
 * Get financial statistics for Accountant dashboard
 */
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
    getPaymentsByOrderId,
    recordPayment,
    getFinanceStats
};
