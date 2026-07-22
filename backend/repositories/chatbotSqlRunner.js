const pool = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// Lớp an toàn cho Text-to-SQL của chatbot.
//
// Nhiều tầng phòng thủ (defense in depth):
//   1. Allowlist VIEW theo role — chatbot chỉ đụng view curated, không bao giờ
//      bảng gốc (accounts/profiles thô... => không lộ password/PII).
//   2. Chỉ cho phép 1 câu SELECT/WITH — chặn mọi từ khoá ghi/DDL.
//   3. Kiểm mọi bảng sau FROM/JOIN phải nằm trong allowlist (CTE name được bỏ qua).
//   4. Chạy trong transaction READ ONLY — DÙ có lọt tầng trên, Postgres vẫn cấm ghi.
//   5. statement_timeout 8s — chặn query nặng treo DB.
//   6. Bọc LIMIT — chặn trả về quá nhiều dòng.
//   7. SET LOCAL app.actor_id — để các view v_chatbot_my_* tự lọc theo tài xế.
// ─────────────────────────────────────────────────────────────────────────────

// Allowlist view theo role. Base tables KHÔNG bao giờ có ở đây.
const OPERATIONAL_VIEWS = [
    'v_chatbot_orders', 'v_chatbot_shipments', 'v_chatbot_incidents',
    'v_chatbot_vehicles', 'v_chatbot_vehicle_groups',
    'v_chatbot_customers', 'v_chatbot_partners', 'v_chatbot_staff',
];
const FINANCIAL_VIEWS = [
    'v_chatbot_debts', 'v_chatbot_kpi', 'v_chatbot_payrolls',
    'v_chatbot_expenses', 'v_chatbot_financial_transactions', 'v_chatbot_invoices',
];
const DRIVER_VIEWS = [
    'v_chatbot_my_kpi', 'v_chatbot_my_payroll', 'v_chatbot_my_debts',
    'v_chatbot_my_shipments', 'v_chatbot_my_salary_advances', 'v_chatbot_my_bonuses',
    'v_chatbot_vehicle_groups',
];

const ROLE_ALLOWLIST = {
    admin:       [...OPERATIONAL_VIEWS, ...FINANCIAL_VIEWS],
    manager:     [...OPERATIONAL_VIEWS, ...FINANCIAL_VIEWS],
    accountant:  [...OPERATIONAL_VIEWS, ...FINANCIAL_VIEWS],
    coordinator: [...OPERATIONAL_VIEWS],
    driver:      [...DRIVER_VIEWS],
};

const getAllowedViews = (role) => ROLE_ALLOWLIST[role] || [];

// Từ khoá ghi / DDL bị cấm tuyệt đối (bọc \b để khớp nguyên từ).
const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|vacuum|reindex|comment|merge|lock|set|reset|prepare|execute|analyze|cluster|listen|notify)\b/i;

const stripTrailingSemicolons = (sql) => sql.replace(/;\s*$/g, '').trim();

// Lấy tên CTE (WITH x AS (...), y AS (...)) để không bị report nhầm là bảng lạ.
// CTE luôn có dạng "<tên> AS (" — table alias (table alias) và subquery alias
// (") AS sub") không khớp mẫu này nên không bị bắt nhầm.
const extractCteNames = (sql) => {
    const names = new Set();
    const re = /\b([a-z_][a-z0-9_]*)\s+as\s*\(/gi;
    let m;
    while ((m = re.exec(sql)) !== null) names.add(m[1].toLowerCase());
    return names;
};

// Lấy mọi bảng sau FROM / JOIN.
const extractTables = (sql) => {
    const tables = [];
    const re = /(?:\bfrom\b|\bjoin\b)\s+([a-z_][a-z0-9_.]*)/gi;
    let m;
    while ((m = re.exec(sql)) !== null) tables.push(m[1].toLowerCase());
    return tables;
};

/**
 * Kiểm tra 1 câu SQL có an toàn để chạy không.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
const validateSelect = (rawSql, allowedViews) => {
    const sql = stripTrailingSemicolons(String(rawSql || ''));
    if (!sql) return { ok: false, reason: 'Câu SQL rỗng.' };

    // 1 câu duy nhất — không cho nhiều statement.
    if (sql.includes(';')) return { ok: false, reason: 'Chỉ cho phép một câu SELECT duy nhất.' };

    // Phải bắt đầu bằng SELECT hoặc WITH.
    if (!/^\s*(select|with)\b/i.test(sql)) {
        return { ok: false, reason: 'Chỉ cho phép câu SELECT (hoặc WITH ... SELECT).' };
    }

    // Chặn từ khoá ghi/DDL.
    if (FORBIDDEN.test(sql)) {
        return { ok: false, reason: 'Câu SQL chứa từ khoá không được phép (chỉ đọc dữ liệu).' };
    }

    // Mọi bảng phải thuộc allowlist (trừ CTE name).
    const cte = extractCteNames(sql);
    const allowed = new Set(allowedViews.map((v) => v.toLowerCase()));
    for (const t of extractTables(sql)) {
        if (cte.has(t)) continue;
        if (!allowed.has(t)) {
            return { ok: false, reason: `Không được truy vấn bảng "${t}". Chỉ dùng các view được phép.` };
        }
    }
    return { ok: true };
};

/**
 * Chạy 1 câu SELECT an toàn trong transaction READ ONLY.
 * @param {string} rawSql
 * @param {{ role: string, actorId: number|string, maxRows?: number }} ctx
 * @returns {Promise<{ rows: object[], rowCount: number, truncated: boolean }>}
 */
const runReadOnlyQuery = async (rawSql, { role, actorId, maxRows = 200 }) => {
    const allowedViews = getAllowedViews(role);
    if (allowedViews.length === 0) {
        throw new Error('Vai trò này không được phép truy vấn dữ liệu.');
    }

    const check = validateSelect(rawSql, allowedViews);
    if (!check.ok) throw new Error(check.reason);

    const sql = stripTrailingSemicolons(rawSql);
    const limit = Math.min(Math.max(1, Number(maxRows) || 200), 500);
    // Bọc trong subquery + LIMIT — chặn số dòng, đồng thời vô hiệu hoá mọi mưu
    // đồ chèn thêm statement (sẽ thành lỗi cú pháp; READ ONLY vẫn chặn ghi).
    const wrapped = `SELECT * FROM (${sql}) AS _chatbot_sub LIMIT ${limit + 1}`;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SET TRANSACTION READ ONLY');
        await client.query('SET LOCAL statement_timeout = 8000');
        // actorId cho các view v_chatbot_my_* (set qua param an toàn).
        await client.query("SELECT set_config('app.actor_id', $1, true)", [String(actorId ?? '')]);

        const result = await client.query(wrapped);
        await client.query('ROLLBACK');

        const truncated = result.rows.length > limit;
        return {
            rows: truncated ? result.rows.slice(0, limit) : result.rows,
            rowCount: truncated ? limit : result.rows.length,
            truncated,
        };
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        throw err;
    } finally {
        client.release();
    }
};

// Sinh mô tả schema (cho prompt) TỪ information_schema — luôn khớp DB thật,
// không hard-code tên cột. Cache theo role.
const schemaCache = new Map();

const getSchemaForRole = async (role) => {
    if (schemaCache.has(role)) return schemaCache.get(role);

    const allowedViews = getAllowedViews(role);
    if (allowedViews.length === 0) return '(không có bảng nào được phép)';

    const { rows } = await pool.query(
        `SELECT table_name, column_name, data_type
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ANY($1)
         ORDER BY table_name, ordinal_position`,
        [allowedViews],
    );

    const byTable = new Map();
    for (const r of rows) {
        if (!byTable.has(r.table_name)) byTable.set(r.table_name, []);
        byTable.get(r.table_name).push(`${r.column_name} ${r.data_type}`);
    }

    const lines = [];
    for (const view of allowedViews) {
        const cols = byTable.get(view);
        if (cols) lines.push(`${view}(${cols.join(', ')})`);
    }
    const schema = lines.join('\n');
    schemaCache.set(role, schema);
    return schema;
};

module.exports = {
    ROLE_ALLOWLIST,
    getAllowedViews,
    validateSelect,
    runReadOnlyQuery,
    getSchemaForRole,
    _clearSchemaCache: () => schemaCache.clear(),
};
