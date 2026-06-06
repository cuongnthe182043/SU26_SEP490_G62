const pool = require('../config/database');

const getDriverBills = async (driverId, { status = null, shipmentId = null, month = null, year = null } = {}) => {
    const params = [driverId];
    const conditions = ['b.driver_id = $1'];

    if (status)     { params.push(status);     conditions.push(`b.status = $${params.length}`); }
    if (shipmentId) { params.push(shipmentId); conditions.push(`b.shipment_id = $${params.length}`); }
    if (month)      { params.push(month);      conditions.push(`EXTRACT(MONTH FROM b.collected_at) = $${params.length}`); }
    if (year)       { params.push(year);       conditions.push(`EXTRACT(YEAR  FROM b.collected_at) = $${params.length}`); }

    const result = await pool.query(
        `SELECT
            b.id,
            b.amount::text,
            b.payment_method,
            b.status,
            b.notes,
            b.receipt_url,
            b.collected_at,
            b.confirmed_at,
            b.reject_reason,
            b.debt_id,
            b.shipment_id,
            os.trip_code,
            o.cargo_name
         FROM bills b
         LEFT JOIN order_shipments os ON os.id = b.shipment_id
         LEFT JOIN orders o            ON o.id  = os.order_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY b.collected_at DESC`,
        params,
    );
    return result.rows;
};

const getBillById = async (id, driverId) => {
    const result = await pool.query(
        `SELECT
            b.id,
            b.amount::text,
            b.payment_method,
            b.status,
            b.notes,
            b.receipt_url,
            b.collected_at,
            b.confirmed_at,
            b.reject_reason,
            b.debt_id,
            b.shipment_id,
            os.trip_code,
            o.cargo_name
         FROM bills b
         LEFT JOIN order_shipments os ON os.id = b.shipment_id
         LEFT JOIN orders o            ON o.id  = os.order_id
         WHERE b.id = $1 AND b.driver_id = $2`,
        [id, driverId],
    );
    return result.rows[0] ?? null;
};

const createBill = async (driverId, { shipmentId, amount, paymentMethod, notes, receiptUrl }) => {
    const result = await pool.query(
        `INSERT INTO bills
            (driver_id, shipment_id, amount, payment_method, notes, receipt_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [driverId, shipmentId ?? null, amount, paymentMethod, notes ?? null, receiptUrl ?? null],
    );
    return result.rows[0];
};

const getBillSummary = async (driverId) => {
    const result = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE status = 'pending')                          AS pending_count,
            COALESCE(SUM(amount) FILTER (WHERE status = 'pending'),   0)::text  AS pending_amount,
            COUNT(*) FILTER (WHERE status = 'confirmed')                        AS confirmed_count,
            COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0)::text  AS confirmed_amount,
            COUNT(*) FILTER (WHERE status = 'rejected')                         AS rejected_count,
            COUNT(*) FILTER (WHERE status = 'converted')                        AS converted_count
         FROM bills
         WHERE driver_id = $1`,
        [driverId],
    );
    return result.rows[0];
};

module.exports = { getDriverBills, getBillById, createBill, getBillSummary };
