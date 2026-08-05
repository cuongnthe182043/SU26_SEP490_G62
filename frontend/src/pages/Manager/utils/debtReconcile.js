// `customer_debts` chỉ là 50 bên nợ LỚN NHẤT (repo _customerDebtDetail LIMIT 50), còn
// KPI "Nợ phải thu" và biểu đồ tuổi nợ cộng TOÀN BỘ. Cộng thẳng 50 dòng đó rồi gọi là
// "TỔNG CỘNG" là số nhỏ hơn thực tế mà không có dấu hiệu gì — người đọc đối chiếu với
// ô KPI ngay phía trên sẽ thấy lệch và không biết vì sao.
//
// Hàm này bù phần chênh thành một dòng "các bên nợ khác" để tổng in ra luôn đúng bằng
// KPI. Dùng chung cho cả bảng trên màn hình lẫn sheet Excel — hai chỗ lệch nhau còn
// khó hiểu hơn là lệch với KPI.

const num = (v) => Number(v || 0);

// Dưới 1đ thì coi như bằng nhau (làm tròn ::float của Postgres, không phải thiếu tiền).
const EPS = 1;

/**
 * @returns {{ rows, others, total }}
 *   rows   — 50 dòng chi tiết, KÈM dòng "các bên nợ khác" ở cuối nếu có phần chênh
 *   others — dòng chênh (null nếu không có)
 *   total  — tổng của đúng những dòng trong `rows`
 */
export function reconcileDebtRows(debts = [], cashflow = {}) {
    const aging = cashflow.debt_aging ?? {};
    const rows = debts.map((c) => ({
        name: c.name,
        party_type: c.party_type,
        outstanding: num(c.outstanding),
        d0_30: num(c.d0_30),
        d30_60: num(c.d30_60),
        d60_90: num(c.d60_90),
        d90_plus: num(c.d90_plus),
        unpaid_orders: num(c.unpaid_orders),
    }));

    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    const gap = num(cashflow.receivable_total) - sum("outstanding");

    let others = null;
    if (gap > EPS) {
        others = {
            name: `Các bên nợ khác (ngoài ${rows.length} bên nợ lớn nhất)`,
            party_type: null,
            outstanding: gap,
            d0_30: num(aging.d0_30) - sum("d0_30"),
            d30_60: num(aging.d30_60) - sum("d30_60"),
            d60_90: num(aging.d60_90) - sum("d60_90"),
            d90_plus: num(aging.d90_plus) - sum("d90_plus"),
            // Không biết số đơn của phần này — để null để không in ra một con số bịa.
            unpaid_orders: null,
        };
        rows.push(others);
    }

    const total = {
        outstanding: sum("outstanding"),
        d0_30: sum("d0_30"),
        d30_60: sum("d30_60"),
        d60_90: sum("d60_90"),
        d90_plus: sum("d90_plus"),
        unpaid_orders: rows.reduce((s, r) => s + num(r.unpaid_orders), 0),
    };

    return { rows, others, total };
}
