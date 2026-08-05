const pool = require('../config/database');
const financialLedgerRepository = require('./financialLedgerRepository');

// Lỗi do người dùng (sai đối tượng, sai trạng thái) phải mang status 400 — sendError()
// coi mọi lỗi không có status là lỗi máy chủ và trả về câu chung chung, người dùng
// không biết vì sao thao tác bị từ chối.
const err400 = (msg) => Object.assign(new Error(msg), { status: 400 });

const buildDebtStatus = (paidAmount, totalAmount) => {
    if (!totalAmount || totalAmount === 0) return 'paid';
    if (paidAmount >= totalAmount - 0.01) return 'paid';
    if (paidAmount > 0) return 'partial';
    return 'unpaid';
};

const getAllDebts = async ({
    debtType = null,
    status = null,
    customerSearch = null,
    driverSearch = null,
    page = 1,
    limit = 20,
} = {}) => {
    const params = [];
    const baseConditions = [];

    if (debtType) {
        params.push(debtType);
        baseConditions.push(`d.debt_type = $${params.length}`);
    }
    if (customerSearch && customerSearch.trim()) {
        params.push(`%${customerSearch.trim()}%`);
        baseConditions.push(`(
            c.full_name ILIKE $${params.length}
            OR c.company_name ILIKE $${params.length}
            OR c.phone ILIKE $${params.length}
        )`);
    }
    if (driverSearch && driverSearch.trim()) {
        params.push(`%${driverSearch.trim()}%`);
        baseConditions.push(`dr.full_name ILIKE $${params.length}`);
    }

    const baseWhere = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';

    let statusFilter = '';
    if (status) {
        params.push(status);
        statusFilter = `AND computed_status = $${params.length}`;
    }

    const cteSql = `
        WITH base_debts AS (
            SELECT
                d.id,
                d.debt_type,
                d.total_amount,
                COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0) AS paid_amount,
                GREATEST(0, COALESCE(d.total_amount, 0) - COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0)) AS remaining,
                CASE
                    WHEN COALESCE(d.total_amount, 0) <= 0 THEN 'paid'
                    WHEN COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0) >= d.total_amount - 0.01 THEN 'paid'
                    WHEN COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0) > 0 THEN 'partial'
                    ELSE 'unpaid'
                END AS computed_status,
                d.due_date, d.notes, d.created_at, d.updated_at,
                d.order_id, d.shipment_id,
                c.id              AS customer_id,
                c.full_name       AS customer_name,
                c.company_name    AS customer_company,
                c.phone           AS customer_phone,
                dr.id             AS driver_id,
                dr.full_name      AS driver_name,
                dr.phone          AS driver_phone,
                o.cargo_name      AS order_cargo_name,
                o.created_at      AS order_date
            FROM debts d
            LEFT JOIN debt_payments dp ON dp.debt_id = d.id
            LEFT JOIN customers c ON c.id = d.customer_id
            LEFT JOIN profiles dr ON dr.id = d.driver_id
            LEFT JOIN orders o ON o.id = d.order_id
            ${baseWhere}
            GROUP BY
                d.id, d.debt_type, d.total_amount, d.due_date, d.notes,
                d.created_at, d.updated_at, d.order_id, d.shipment_id,
                c.id, c.full_name, c.company_name, c.phone,
                dr.id, dr.full_name, dr.phone,
                o.cargo_name, o.created_at
        )
    `;

    const countResult = await pool.query(
        `${cteSql} SELECT COUNT(*)::int AS total FROM base_debts WHERE TRUE ${statusFilter}`,
        params,
    );
    const totalItems = countResult.rows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const mainParams = [...params, limit, offset];

    const mainResult = await pool.query(
        `${cteSql}
         SELECT * FROM base_debts WHERE TRUE ${statusFilter}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        mainParams,
    );

    return {
        debts: mainResult.rows,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        limit,
    };
};

const getDebtStats = async () => {
    const result = await pool.query(`
        WITH dp_agg AS (
            SELECT debt_id, COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS paid
            FROM debt_payments
            GROUP BY debt_id
        )
        SELECT
            d.debt_type,
            COUNT(*)::int                                                               AS count,
            COALESCE(SUM(d.total_amount), 0)::text                                     AS total_amount,
            COALESCE(SUM(COALESCE(dp_agg.paid, 0)), 0)::text                           AS total_paid,
            COALESCE(SUM(GREATEST(0, d.total_amount - COALESCE(dp_agg.paid, 0))), 0)::text AS total_remaining
        FROM debts d
        LEFT JOIN dp_agg ON dp_agg.debt_id = d.id
        WHERE GREATEST(0, d.total_amount - COALESCE(dp_agg.paid, 0)) > 0.01
        GROUP BY d.debt_type
    `);

    const byType = {};
    let overallRemaining = 0;

    for (const row of result.rows) {
        byType[row.debt_type] = {
            count: row.count,
            total_amount: Number(row.total_amount),
            total_paid: Number(row.total_paid),
            total_remaining: Number(row.total_remaining),
        };
        overallRemaining += Number(row.total_remaining);
    }

    return {
        byType,
        totalRemaining: overallRemaining,
    };
};

const getDebtsGroupedByPerson = async ({
    debtType = null,
    status = null,
    customerSearch = null,
    driverSearch = null,
    page = 1,
    limit = 20,
} = {}) => {
    const params = [];
    const conditions = [];

    if (debtType) {
        params.push(debtType);
        conditions.push(`d.debt_type = $${params.length}`);
    }
    if (customerSearch && customerSearch.trim()) {
        params.push(`%${customerSearch.trim()}%`);
        conditions.push(`(
            c.full_name ILIKE $${params.length}
            OR c.company_name ILIKE $${params.length}
            OR c.phone ILIKE $${params.length}
        )`);
    }
    if (driverSearch && driverSearch.trim()) {
        params.push(`%${driverSearch.trim()}%`);
        conditions.push(`dr.full_name ILIKE $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let havingClause = '';
    if (status) {
        params.push(status);
        havingClause = `
            HAVING CASE
                WHEN SUM(sub.total_amount) - SUM(sub.paid_amount) <= 0.01 THEN 'paid'
                WHEN SUM(sub.paid_amount) > 0 THEN 'partial'
                ELSE 'unpaid'
            END = $${params.length}
        `;
    }

    // Gom theo đúng chủ nợ. Thiếu partner_id thì mọi khoản nợ đối tác dồn vào cùng một
    // nhóm rỗng (customer_id và driver_id đều NULL) và hiện ra như một dòng không tên.
    const groupByCol = debtType === 'driver' ? 'sub.driver_id' :
                       debtType === 'customer' ? 'sub.customer_id' :
                       debtType === 'partner' ? 'sub.partner_id' :
                       'sub.customer_id, sub.driver_id, sub.partner_id';

    const innerSql = `
        SELECT
            d.debt_type, d.driver_id,
            c.full_name AS customer_name, c.company_name AS customer_company, c.phone AS customer_phone,
            dr.full_name AS driver_name, dr.phone AS driver_phone,
            pn.company_name AS partner_name, pn.phone AS partner_phone,
            d.total_amount,
            COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.debt_id = d.id AND dp.status = 'confirmed'), 0) AS paid_amount,
            d.due_date, d.created_at,
            d.id AS debt_id, d.customer_id, d.partner_id, d.shipment_id, d.order_id
        FROM debts d
        LEFT JOIN customers c ON c.id = d.customer_id
        LEFT JOIN profiles dr ON dr.id = d.driver_id
        LEFT JOIN partners pn ON pn.id = d.partner_id
        ${where}
    `;

    const countQuery = `
        SELECT COUNT(*)::int AS total FROM (
            SELECT 1 FROM (${innerSql}) sub
            GROUP BY ${groupByCol}
            ${havingClause}
        ) t
    `;
    const countResult = await pool.query(countQuery, params);
    const totalPersons = countResult.rows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const queryParams = [...params, limit, offset];

    const mainQuery = `
        SELECT
            MAX(sub.debt_type)        AS debt_type,
            MAX(sub.driver_id)        AS driver_id,
            MAX(sub.customer_name)    AS customer_name,
            MAX(sub.customer_company) AS customer_company,
            MAX(sub.customer_phone)   AS customer_phone,
            MAX(sub.driver_name)      AS driver_name,
            MAX(sub.driver_phone)     AS driver_phone,
            MAX(sub.partner_id)       AS partner_id,
            MAX(sub.partner_name)     AS partner_name,
            MAX(sub.partner_phone)    AS partner_phone,
            COUNT(*)::int                                        AS debt_count,
            SUM(sub.total_amount)::text                          AS total_amount,
            SUM(sub.paid_amount)::text                           AS total_paid,
            (SUM(sub.total_amount) - SUM(sub.paid_amount))::text AS total_remaining,
            CASE
                WHEN SUM(sub.total_amount) - SUM(sub.paid_amount) <= 0.01 THEN 'paid'
                WHEN SUM(sub.paid_amount) > 0 THEN 'partial'
                ELSE 'unpaid'
            END AS computed_status,
            MIN(sub.due_date)                                     AS earliest_due_date,
            MAX(sub.created_at)                                   AS latest_created_at,
            ARRAY_AGG(DISTINCT sub.customer_id)                   AS customer_ids,
            ARRAY_AGG(sub.debt_id ORDER BY sub.created_at)        AS debt_ids,
            ARRAY_AGG(sub.shipment_id ORDER BY sub.created_at)    AS shipment_ids,
            ARRAY_AGG(sub.order_id ORDER BY sub.created_at)       AS order_ids
        FROM (${innerSql}) sub
        GROUP BY ${groupByCol}
        ${havingClause}
        ORDER BY (SUM(sub.total_amount) - SUM(sub.paid_amount)) DESC NULLS LAST
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await pool.query(mainQuery, queryParams);

    const groupedDebts = result.rows.map((row) => ({
        debt_type: row.debt_type,
        driver_id: row.driver_id,
        customer_name: row.customer_name,
        customer_company: row.customer_company,
        customer_phone: row.customer_phone,
        driver_name: row.driver_name,
        driver_phone: row.driver_phone,
        debt_count: Number(row.debt_count),
        total_amount: Number(row.total_amount || 0),
        total_paid: Number(row.total_paid || 0),
        total_remaining: Number(row.total_remaining || 0),
        computed_status: row.computed_status,
        earliest_due_date: row.earliest_due_date,
        latest_created_at: row.latest_created_at,
        customer_ids: row.customer_ids,
        debt_ids: row.debt_ids,
        shipment_ids: row.shipment_ids,
        order_ids: row.order_ids,
    }));

    return {
        debts: groupedDebts,
        totalPersons,
        totalPages: Math.ceil(totalPersons / limit),
        currentPage: page,
        limit,
    };
};

const getDebtsByPerson = async (personType, personId) => {
    const whereField = personType === 'driver' ? 'd.driver_id'
        : personType === 'partner' ? 'd.partner_id'
        : 'd.customer_id';
    const result = await pool.query(`
        SELECT
            d.id,
            d.debt_type,
            d.total_amount::text,
            COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0)::text AS paid_amount,
            GREATEST(0, d.total_amount - COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0))::text AS remaining,
            d.due_date,
            d.notes,
            d.created_at,
            d.updated_at,
            d.order_id,
            d.shipment_id,
            d.driver_id,
            d.source,
            d.incurred_on,
            o.cargo_name      AS order_cargo_name,
            o.created_at      AS order_date,
            os.estimated_price AS shipment_price,
            c.full_name    AS customer_name,
            c.company_name AS customer_company,
            c.phone        AS customer_phone,
            dr.full_name   AS driver_name,
            dr.phone       AS driver_phone,
            pn.company_name AS partner_name,
            pn.phone        AS partner_phone
        FROM debts d
        LEFT JOIN debt_payments dp ON dp.debt_id = d.id
        LEFT JOIN orders o ON o.id = d.order_id
        LEFT JOIN order_shipments os ON os.id = d.shipment_id
        LEFT JOIN customers c ON c.id = d.customer_id
        LEFT JOIN profiles dr ON dr.id = d.driver_id
        LEFT JOIN partners pn ON pn.id = d.partner_id
        WHERE ${whereField} = $1 AND d.debt_type = $2
        GROUP BY
            d.id, d.debt_type, d.total_amount, d.due_date, d.notes,
            d.created_at, d.updated_at, d.order_id, d.shipment_id, d.driver_id,
            d.source, d.incurred_on,
            o.cargo_name, o.created_at, os.estimated_price,
            c.full_name, c.company_name, c.phone,
            dr.full_name, dr.phone,
            pn.company_name, pn.phone
        ORDER BY d.created_at DESC
    `, [personId, personType]);

    return result.rows.map((row) => ({
        ...row,
        total_amount: Number(row.total_amount),
        paid_amount: Number(row.paid_amount),
        remaining: Number(row.remaining),
        shipment_price: Number(row.shipment_price),
        computed_status: buildDebtStatus(Number(row.paid_amount), Number(row.total_amount)),
    }));
};

const getDebtsByCustomerIds = async (customerIds) => {
    const result = await pool.query(`
        SELECT
            d.id,
            d.debt_type,
            d.customer_id,
            d.order_id,
            d.shipment_id,
            d.total_amount,
            COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0) AS paid_amount,
            GREATEST(0, d.total_amount - COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0)) AS remaining,
            d.due_date,
            d.notes,
            d.created_at,
            o.cargo_name AS order_cargo_name,
            os.estimated_price AS shipment_price,
            c.full_name    AS customer_name,
            c.company_name AS customer_company,
            c.phone        AS customer_phone,
            dr.full_name   AS driver_name,
            dr.phone       AS driver_phone
        FROM debts d
        LEFT JOIN debt_payments dp ON dp.debt_id = d.id
        LEFT JOIN orders o ON o.id = d.order_id
        LEFT JOIN order_shipments os ON os.id = d.shipment_id
        LEFT JOIN customers c ON c.id = d.customer_id
        LEFT JOIN profiles dr ON dr.id = d.driver_id
        WHERE d.customer_id = ANY($1::int[])
        GROUP BY
            d.id, d.debt_type, d.customer_id, d.order_id, d.shipment_id,
            d.total_amount, d.due_date, d.notes, d.created_at,
            o.cargo_name, os.estimated_price,
            c.full_name, c.company_name, c.phone,
            dr.full_name, dr.phone
        ORDER BY d.created_at DESC
    `, [customerIds]);

    return result.rows.map((row) => ({
        ...row,
        total_amount: Number(row.total_amount),
        paid_amount: Number(row.paid_amount),
        remaining: Number(row.remaining),
        shipment_price: Number(row.shipment_price),
        computed_status: buildDebtStatus(Number(row.paid_amount), Number(row.total_amount)),
    }));
};

// Chuyển công nợ khách hàng sang công nợ tài xế — tái phân loại khoản phải thu, KHÔNG
// phải một khoản thanh toán thật (không có tiền mặt/chuyển khoản nào di chuyển). Đóng
// khoản nợ khách bằng 1 debt_payments 'offset' (giống cơ chế cấn trừ tài đã ứng), mở
// khoản nợ tài xế mới cùng số tiền, và ghi 1 bút toán duy nhất Nợ 1388 / Có 131.
const transferToDriver = async (debtId, { toDriverId, notes }, actorId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: [debt] } = await client.query(
            `SELECT
                d.id, d.debt_type, d.customer_id, d.order_id, d.shipment_id, d.total_amount,
                COALESCE(paid.paid, 0) AS paid_amount,
                GREATEST(0, d.total_amount - COALESCE(paid.paid, 0)) AS remaining
             FROM debts d
             LEFT JOIN LATERAL (
                 SELECT COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0) AS paid
                 FROM debt_payments dp WHERE dp.debt_id = d.id
             ) paid ON TRUE
             WHERE d.id = $1
             FOR UPDATE OF d`,
            [debtId],
        );
        if (!debt) throw Object.assign(new Error('Không tìm thấy công nợ.'), { status: 404 });
        if (debt.debt_type !== 'customer') {
            throw Object.assign(new Error('Chỉ chuyển được công nợ khách hàng sang công nợ tài xế.'), { status: 400 });
        }
        const remaining = Number(debt.remaining);
        if (remaining <= 0.01) {
            throw Object.assign(new Error('Công nợ này đã tất toán, không còn số dư để chuyển.'), { status: 409 });
        }

        const { rows: [driver] } = await client.query(
            `SELECT profile_id FROM drivers WHERE profile_id = $1`, [toDriverId],
        );
        if (!driver) throw Object.assign(new Error('Tài xế không tồn tại.'), { status: 400 });

        // Đóng nợ khách bằng bút toán cấn trừ nội bộ (không phải khách trả tiền thật)
        await client.query(
            `INSERT INTO debt_payments (debt_id, amount, payment_method, status, paid_at, confirmed_at, confirmed_by, created_by, notes)
             VALUES ($1, $2, 'offset', 'confirmed', NOW(), NOW(), $3, $3, $4)`,
            [debt.id, remaining, actorId, notes || `Chuyển sang công nợ tài xế #${toDriverId}`],
        );

        const { rows: [newDebt] } = await client.query(
            `INSERT INTO debts (debt_type, driver_id, order_id, shipment_id, total_amount, notes, updated_by, created_at, updated_at)
             VALUES ('driver', $1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING id`,
            [toDriverId, debt.order_id, debt.shipment_id, remaining, notes || `Chuyển từ công nợ khách hàng #${debt.id}`, actorId],
        );

        await financialLedgerRepository.insertTransaction(client, {
            eventType: 'debt_transferred',
            debitAccount: '1388',
            creditAccount: '131',
            amount: remaining,
            description: `Chuyển công nợ #${debt.id} (khách hàng) sang công nợ #${newDebt.id} (tài xế #${toDriverId})`,
            refType: 'debt', refId: newDebt.id, actorId,
        });

        await client.query('COMMIT');
        return { closedDebtId: debt.id, newDebtId: newDebt.id, amount: remaining };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// ─── Công nợ khai tay (nợ cũ, có trước khi dùng phần mềm) ────────────────────

/** Cặp tài khoản ghi số dư đầu kỳ theo từng loại nợ. */
const OPENING_BALANCE_ACCOUNTS = {
    // Phải thu khách hàng / đối tác
    customer: { debit: '131',  credit: '3388' },
    partner:  { debit: '131',  credit: '3388' },
    // Phải thu khác — tài xế đang giữ tiền của công ty
    driver:   { debit: '1388', credit: '3388' },
};

const DEBT_OWNER_COLUMN = { customer: 'customer_id', partner: 'partner_id', driver: 'driver_id' };

/** Bảng dùng để xác nhận đối tượng công nợ có thật và đúng loại. */
const OWNER_LOOKUP = {
    customer: { sql: 'SELECT id FROM customers WHERE id = $1', label: 'Khách hàng' },
    partner:  { sql: 'SELECT id FROM partners  WHERE id = $1', label: 'Đối tác' },
    // Phải tra bảng drivers, không phải profiles: profiles chứa cả điều phối và kế toán
    driver:   { sql: 'SELECT profile_id AS id FROM drivers WHERE profile_id = $1', label: 'Tài xế' },
};

const assertOwnerExists = async (client, debtType, ownerId) => {
    const lookup = OWNER_LOOKUP[debtType];
    const { rows } = await client.query(lookup.sql, [ownerId]);
    if (rows.length === 0) {
        throw err400(`${lookup.label} không tồn tại trong hệ thống (mã ${ownerId}).`);
    }
};

/** Số tiền đã thu (confirmed) của một khoản nợ — dùng để chặn sửa/xoá khoản đã động vào. */
const getConfirmedPaidAmount = async (client, debtId) => {
    const { rows } = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS paid, COUNT(*)::int AS so_lan
         FROM debt_payments WHERE debt_id = $1 AND status IN ('pending', 'confirmed')`,
        [debtId],
    );
    return { paid: Number(rows[0].paid), count: rows[0].so_lan };
};

/** Đọc khoản nợ và chặn nếu không phải nợ khai tay hoặc đã có thanh toán. */
const loadEditableManualDebt = async (client, debtId) => {
    const { rows } = await client.query(
        `SELECT id, debt_type, source, total_amount, customer_id, partner_id, driver_id
         FROM debts WHERE id = $1 FOR UPDATE`,
        [debtId],
    );
    if (rows.length === 0) throw Object.assign(new Error('Không tìm thấy công nợ.'), { status: 404 });
    const debt = rows[0];

    // Nợ sinh từ chuyến phải sửa bằng cách sửa chuyến, không cho sửa thẳng ở đây —
    // sửa thẳng thì số nợ lệch khỏi giá trị chuyến và không còn đối chiếu được.
    if (debt.source !== 'manual') {
        throw err400('Chỉ sửa/xoá được công nợ khai tay. Khoản này sinh từ chuyến — sửa ở đơn hàng.');
    }

    const { count } = await getConfirmedPaidAmount(client, debt.id);
    if (count > 0) {
        throw err400('Công nợ đã có phát sinh thanh toán nên không sửa/xoá được. Hãy ghi nhận điều chỉnh bằng một khoản đối ứng.');
    }
    return debt;
};

/**
 * Tra đối tượng công nợ cho ô chọn ở form khai tay — khách / tài xế / đối tác.
 *
 * Kế toán không có quyền gọi /api/customers (dành cho điều phối & quản lý) nên cần một
 * đường tra riêng, chỉ trả đúng thứ cần cho ô chọn chứ không phải cả hồ sơ khách hàng.
 */
const searchDebtOwners = async (ownerType, keyword = '', limit = 20) => {
    const q = `%${String(keyword).trim()}%`;
    const queries = {
        customer: `SELECT c.id, COALESCE(c.full_name, c.company_name) AS name, c.phone
                   FROM customers c
                   WHERE $1 = '%%' OR c.full_name ILIKE $1 OR c.company_name ILIKE $1 OR c.phone ILIKE $1
                   ORDER BY COALESCE(c.full_name, c.company_name) ASC NULLS LAST LIMIT $2`,
        partner:  `SELECT p.id, p.company_name AS name, p.phone
                   FROM partners p
                   WHERE $1 = '%%' OR p.company_name ILIKE $1 OR p.phone ILIKE $1
                   ORDER BY p.company_name ASC LIMIT $2`,
        driver:   `SELECT pr.id, pr.full_name AS name, pr.phone
                   FROM drivers d JOIN profiles pr ON pr.id = d.profile_id
                   WHERE $1 = '%%' OR pr.full_name ILIKE $1 OR pr.phone ILIKE $1
                   ORDER BY pr.full_name ASC LIMIT $2`,
    };
    const { rows } = await pool.query(queries[ownerType], [q, limit]);
    return rows;
};

/**
 * Khai một khoản công nợ có sẵn từ trước khi dùng phần mềm.
 *
 * Ghi kèm bút toán 'opening_balance' vào sổ: nợ sinh từ chuyến không cần vế này vì
 * doanh thu đã ghi Nợ 131 rồi, còn nợ cũ thì chưa có gì — thiếu vế ghi Nợ thì lúc thu
 * tiền sổ sẽ ghi Có 131 cho khoản chưa từng ghi Nợ, tài khoản 131 âm và xuất MISA lệch.
 */
const createManualDebt = async ({
    debtType, ownerId, totalAmount, incurredOn, dueDate, notes, createdBy,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ownerColumn = DEBT_OWNER_COLUMN[debtType];
        const accounts = OPENING_BALANCE_ACCOUNTS[debtType];

        // Đối tượng phải TỒN TẠI và ĐÚNG LOẠI. Khoá ngoại của driver_id trỏ tới profiles
        // nên một profile bất kỳ (điều phối, kế toán) vẫn lọt qua nếu chỉ dựa vào FK —
        // và khoản nợ đó sẽ bị khấu trừ vào lương của người không phải tài xế.
        await assertOwnerExists(client, debtType, ownerId);

        const { rows } = await client.query(
            `INSERT INTO debts (
                debt_type, ${ownerColumn}, total_amount, due_date, notes,
                source, incurred_on, created_by, updated_by, created_at, updated_at
            )
             VALUES ($1, $2, $3, $4, $5, 'manual', $6, $7, $7, NOW(), NOW())
             RETURNING id, debt_type, total_amount, due_date, incurred_on, notes`,
            [debtType, ownerId, totalAmount, dueDate, notes, incurredOn, createdBy],
        );
        const debt = rows[0];

        await financialLedgerRepository.insertTransaction(client, {
            eventType: 'opening_balance',
            debitAccount: accounts.debit, creditAccount: accounts.credit,
            amount: totalAmount,
            description: `Số dư đầu kỳ — công nợ ${debtType} khai tay #${debt.id}`,
            refType: 'debt', refId: debt.id, actorId: createdBy,
            // Ghi sổ theo NGÀY PHÁT SINH THẬT, không phải ngày khai — nếu không thì
            // toàn bộ nợ cũ dồn hết vào kỳ kế toán hiện tại.
            occurredAt: incurredOn || null,
        });

        await client.query('COMMIT');
        return debt;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/** Sửa khoản nợ khai tay khi chưa phát sinh thanh toán nào. */
const updateManualDebt = async (debtId, { totalAmount, incurredOn, dueDate, notes }, actorId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const debt = await loadEditableManualDebt(client, debtId);

        const { rows } = await client.query(
            `UPDATE debts
             SET total_amount = $2, incurred_on = $3, due_date = $4, notes = $5,
                 updated_by = $6, updated_at = NOW()
             WHERE id = $1
             RETURNING id, debt_type, total_amount, due_date, incurred_on, notes`,
            [debtId, totalAmount, incurredOn, dueDate, notes, actorId],
        );

        // Sổ đã ghi số cũ rồi, không sửa bút toán cũ (append-only) mà đảo nó rồi ghi lại
        // số mới — giữ nguyên vết đã từng khai bao nhiêu.
        if (Number(debt.total_amount) !== Number(totalAmount)) {
            const accounts = OPENING_BALANCE_ACCOUNTS[debt.debt_type];
            await financialLedgerRepository.insertTransaction(client, {
                eventType: 'opening_balance',
                debitAccount: accounts.credit, creditAccount: accounts.debit,
                amount: debt.total_amount,
                description: `Đảo số dư đầu kỳ do sửa lại — công nợ #${debtId}`,
                refType: 'debt', refId: debtId, actorId,
                occurredAt: incurredOn || null,
            });
            await financialLedgerRepository.insertTransaction(client, {
                eventType: 'opening_balance',
                debitAccount: accounts.debit, creditAccount: accounts.credit,
                amount: totalAmount,
                description: `Số dư đầu kỳ sau khi sửa — công nợ #${debtId}`,
                refType: 'debt', refId: debtId, actorId,
                occurredAt: incurredOn || null,
            });
        }

        await client.query('COMMIT');
        return rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/** Xoá khoản nợ khai tay khi chưa phát sinh thanh toán nào, kèm đảo bút toán đã ghi. */
const deleteManualDebt = async (debtId, actorId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const debt = await loadEditableManualDebt(client, debtId);

        const accounts = OPENING_BALANCE_ACCOUNTS[debt.debt_type];
        await financialLedgerRepository.insertTransaction(client, {
            eventType: 'opening_balance',
            debitAccount: accounts.credit, creditAccount: accounts.debit,
            amount: debt.total_amount,
            description: `Đảo số dư đầu kỳ do xoá khoản khai nhầm — công nợ #${debtId}`,
            refType: 'debt', refId: debtId, actorId,
        });

        await client.query('DELETE FROM debts WHERE id = $1', [debtId]);
        await client.query('COMMIT');
        return { id: debtId };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = {
    getAllDebts, getDebtStats, getDebtsGroupedByPerson, getDebtsByPerson,
    getDebtsByCustomerIds, transferToDriver,
    createManualDebt, updateManualDebt, deleteManualDebt, searchDebtOwners,
};

