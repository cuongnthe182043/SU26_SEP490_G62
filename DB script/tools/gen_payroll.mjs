// Để chính backend tính bảng lương T6 + T7 trên DB seedcheck, rồi xuất ra INSERT
// để nhét vào seed.sql. Không tự tính tay — công thức có 12 thành phần.
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "5432";
process.env.DB_NAME = "seedcheck";
process.env.DB_USER = "postgres";
process.env.DB_PASSWORD = process.env.SEED_DB_PASSWORD || "postgres";
process.env.JWT_SECRET = "seed-only";

const repo = await import("file:///E:/SEP490_G62/SU26_SEP490_G62/backend/repositories/accountantPayrollRepository.js")
  .then((m) => m.default ?? m);
const pool = await import("file:///E:/SEP490_G62/SU26_SEP490_G62/backend/config/database.js")
  .then((m) => m.default ?? m);

for (const [m, y] of [[6, 2026], [7, 2026]]) {
  const r = await repo.calculateAndUpsertPayrolls(m, y);
  console.error(`  T${m}/${y}: ${Array.isArray(r) ? r.length : "?"} bảng lương`);
}

const COLS = [
  "id", "driver_id", "payroll_month", "payroll_year", "base_salary", "months_of_service",
  "total_revenue", "revenue_share_pct", "revenue_bonus", "kpi_bonus", "top_driver_bonus",
  "overtime_bonus", "holiday_bonus", "other_bonus", "manual_bonus", "insurance_employee",
  "insurance_company", "driver_debt_deduction", "advance_deduction", "absence_penalty",
  "other_deduction", "manual_deduction", "expense_reimbursement", "status",
];
const { rows } = await pool.query(
  `SELECT ${COLS.join(", ")} FROM payrolls ORDER BY payroll_year, payroll_month, driver_id`,
);

const lit = (v) => (v === null ? "NULL" : typeof v === "string" ? `'${v}'` : String(v));
let sql = `INSERT INTO payrolls (${COLS.join(", ")}) VALUES\n`;
sql += rows.map((r) => "    (" + COLS.map((c) => lit(r[c])).join(", ") + ")").join(",\n") + ";\n\n";
sql += "SELECT setval(pg_get_serial_sequence('payrolls','id'), (SELECT MAX(id) FROM payrolls));\n";
console.log(sql);

console.error("\n=== BẢNG LƯƠNG BACKEND TÍNH RA ===");
for (const r of rows) {
  console.error(`  T${r.payroll_month} tài ${r.driver_id}: lương CB ${Number(r.base_salary).toLocaleString("vi-VN")}`
    + ` | DT ${Number(r.total_revenue).toLocaleString("vi-VN")} → thưởng DT ${Number(r.revenue_bonus).toLocaleString("vi-VN")}`
    + ` | KPI ${Number(r.kpi_bonus).toLocaleString("vi-VN")} | top ${Number(r.top_driver_bonus).toLocaleString("vi-VN")}`
    + ` | lễ ${Number(r.holiday_bonus).toLocaleString("vi-VN")}`
    + ` | trừ: BH ${Number(r.insurance_employee).toLocaleString("vi-VN")}, nợ ${Number(r.driver_debt_deduction).toLocaleString("vi-VN")}, ứng ${Number(r.advance_deduction).toLocaleString("vi-VN")}, vắng ${Number(r.absence_penalty).toLocaleString("vi-VN")}`
    + ` | hoàn CP ${Number(r.expense_reimbursement).toLocaleString("vi-VN")}`);
}
await pool.end();
