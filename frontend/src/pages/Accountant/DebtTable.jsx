import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

const fmt = (v) => Number(v || 0).toLocaleString("vi-VN");

const STATUS_CFG = {
  paid:    { label: "Đã thanh toán",   color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  partial: { label: "Thu một phần",     color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  unpaid:  { label: "Chưa thanh toán",  color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

const DEBT_TYPE_CFG = {
  customer: { label: "Khách nợ",    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  driver:   { label: "Tài xế nợ",   color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
};

export default function DebtTable({ apiBase, token }) {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [stats, setStats] = useState({ byType: {}, totalRemaining: 0 });

  // Filters
  const [debtTypeFilter, setDebtTypeFilter] = useState(""); // "" | "customer" | "driver"
  const [statusFilter, setStatusFilter] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");

  const fetchDebts = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (debtTypeFilter) params.set("debt_type", debtTypeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (customerSearch.trim()) params.set("customer", customerSearch.trim());
      if (driverSearch.trim()) params.set("driver", driverSearch.trim());

      const res = await fetch(`${apiBase}/accountant/debts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDebts(data.debts || []);
        setPagination({
          currentPage: data.currentPage,
          totalPages: data.totalPages,
          totalItems: data.totalItems,
        });
      }
    } catch (err) {
      console.error("Không tải được công nợ:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${apiBase}/accountant/debts/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Không tải được thống kê công nợ:", err);
    }
  };

  useEffect(() => {
    fetchDebts(1);
    fetchStats();
  }, [debtTypeFilter, statusFilter]);

  const handlePageChange = (page) => {
    fetchDebts(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearch = () => {
    fetchDebts(1);
  };

  const handleClearFilters = () => {
    setDebtTypeFilter("");
    setStatusFilter("");
    setCustomerSearch("");
    setDriverSearch("");
    setTimeout(() => fetchDebts(1), 0);
  };

  // Build stat cards from stats.byType
  const customerStats = stats.byType?.customer;
  const driverStats = stats.byType?.driver;

  return (
    <div>
      {/* Stat summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <DebtStatCard
          label="Tổng nợ khách"
          amount={customerStats?.total_remaining || 0}
          count={customerStats?.count || 0}
          color="#7c3aed"
        />
        <DebtStatCard
          label="Tổng nợ tài xế"
          amount={driverStats?.total_remaining || 0}
          count={driverStats?.count || 0}
          color="#ea580c"
        />
        <DebtStatCard
          label="Tổng còn phải thu"
          amount={stats.totalRemaining || 0}
          count={(customerStats?.count || 0) + (driverStats?.count || 0)}
          color="#dc2626"
        />
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
          padding: "14px 16px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          alignItems: "flex-end",
        }}
      >
        <FilterGroup label="Loại nợ">
          <select
            value={debtTypeFilter}
            onChange={(e) => { setDebtTypeFilter(e.target.value); }}
            style={selectStyle}
          >
            <option value="">Tất cả</option>
            <option value="customer">Khách nợ</option>
            <option value="driver">Tài xế nợ</option>
          </select>
        </FilterGroup>

        <FilterGroup label="Trạng thái">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">Tất cả</option>
            <option value="unpaid">Chưa thanh toán</option>
            <option value="partial">Thu một phần</option>
            <option value="paid">Đã thanh toán</option>
          </select>
        </FilterGroup>

        <FilterGroup label="Tìm khách hàng">
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Tên, công ty, SĐT..."
            style={{ ...inputStyle, width: 160 }}
          />
        </FilterGroup>

        <FilterGroup label="Tìm tài xế">
          <input
            type="text"
            value={driverSearch}
            onChange={(e) => setDriverSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Tên tài xế..."
            style={{ ...inputStyle, width: 140 }}
          />
        </FilterGroup>

        <button
          onClick={handleSearch}
          style={{ ...btnStyle, background: "#1d4ed8", color: "#fff", border: "none" }}
        >
          Tìm kiếm
        </button>
        <button
          onClick={handleClearFilters}
          style={{ ...btnStyle, background: "#f1f5f9", color: "#475569" }}
        >
          Xóa lọc
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          Đang tải dữ liệu công nợ...
        </div>
      ) : debts.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: 12 }}>
            <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>
          </svg>
          <p style={{ color: "#64748b", margin: 0 }}>Không có khoản công nợ nào phù hợp.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  {[
                    "Loại",
                    "Người nợ",
                    "Thông tin liên hệ",
                    "Đơn / Chuyến",
                    "Tổng nợ",
                    "Đã trả",
                    "Còn nợ",
                    "Hạn",
                    "Trạng thái",
                    "Ghi chú",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: "#475569",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {debts.map((debt) => {
                  const total = Number(debt.total_amount || 0);
                  const paid = Number(debt.paid_amount || 0);
                  const remaining = Number(debt.remaining || 0);
                  const typeCfg = DEBT_TYPE_CFG[debt.debt_type] || DEBT_TYPE_CFG.customer;
                  const statusKey = debt.computed_status || "unpaid";
                  const statusCfg = STATUS_CFG[statusKey] || STATUS_CFG.unpaid;

                  const debtorName =
                    debt.debt_type === "driver"
                      ? debt.driver_name || "—"
                      : debt.customer_name || "—";
                  const debtorContact =
                    debt.debt_type === "driver"
                      ? ""
                      : [
                          debt.customer_phone && `📞 ${debt.customer_phone}`,
                          debt.customer_company && `🏢 ${debt.customer_company}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—";

                  const orderRef = debt.order_id
                    ? `#${debt.order_id}${debt.shipment_id ? ` / #${debt.shipment_id}` : ""}`
                    : "—";

                  const dueDate = debt.due_date
                    ? new Date(debt.due_date).toLocaleDateString("vi-VN")
                    : "—";

                  return (
                    <tr
                      key={debt.id}
                      style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Type */}
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            color: typeCfg.color,
                            background: typeCfg.bg,
                            border: `1px solid ${typeCfg.border}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {typeCfg.label}
                        </span>
                      </td>

                      {/* Debtor name */}
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0f172a", maxWidth: 160 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {debtorName}
                        </div>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: "12px 14px", color: "#475569", fontSize: 12, maxWidth: 200 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {debtorContact || "—"}
                        </div>
                      </td>

                      {/* Order / Shipment */}
                      <td style={{ padding: "12px 14px", color: "#64748b", fontFamily: "monospace", fontSize: 12 }}>
                        {orderRef}
                      </td>

                      {/* Total */}
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a", textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmt(total)}đ
                      </td>

                      {/* Paid */}
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#16a34a", textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmt(paid)}đ
                      </td>

                      {/* Remaining */}
                      <td
                        style={{
                          padding: "12px 14px",
                          fontWeight: remaining > 0 ? 700 : 500,
                          color: remaining > 0 ? "#dc2626" : "#16a34a",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmt(remaining)}đ
                      </td>

                      {/* Due date */}
                      <td style={{ padding: "12px 14px", color: "#475569", fontSize: 12, whiteSpace: "nowrap" }}>
                        {dueDate}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            color: statusCfg.color,
                            background: statusCfg.bg,
                            border: `1px solid ${statusCfg.border}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Notes */}
                      <td style={{ padding: "12px 14px", color: "#64748b", fontSize: 12, maxWidth: 180 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {debt.notes || "—"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 0 0",
              }}
            >
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Trang {pagination.currentPage} / {pagination.totalPages} — {pagination.totalItems} khoản nợ
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage <= 1}
                  style={{
                    ...pageBtnStyle,
                    opacity: pagination.currentPage <= 1 ? 0.5 : 1,
                    cursor: pagination.currentPage <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  ← Trước
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === pagination.totalPages ||
                      Math.abs(p - pagination.currentPage) <= 2,
                  )
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span style={{ color: "#cbd5e1", padding: "0 2px" }}>…</span>
                      )}
                      <button
                        onClick={() => handlePageChange(p)}
                        style={{
                          ...pageBtnStyle,
                          background: p === pagination.currentPage ? "#1d4ed8" : "#fff",
                          color: p === pagination.currentPage ? "#fff" : "#475569",
                          borderColor: p === pagination.currentPage ? "#1d4ed8" : "#e2e8f0",
                        }}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage >= pagination.totalPages}
                  style={{
                    ...pageBtnStyle,
                    opacity: pagination.currentPage >= pagination.totalPages ? 0.5 : 1,
                    cursor: pagination.currentPage >= pagination.totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  Sau →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function DebtStatCard({ label, amount, count, color }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", background: "#f8fafc" }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color }}>
        {fmt(amount)}đ
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
        {count} khoản nợ
      </div>
    </div>
  );
}

const selectStyle = {
  border: "1.5px solid #e2e8f0",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
  outline: "none",
  minWidth: 120,
};

const inputStyle = {
  border: "1.5px solid #e2e8f0",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
  outline: "none",
};

const btnStyle = {
  borderRadius: 8,
  padding: "7px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  transition: "background 0.15s",
};

const pageBtnStyle = {
  padding: "6px 12px",
  background: "#fff",
  color: "#475569",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
};

DebtTable.propTypes = {
  apiBase: PropTypes.string,
  token: PropTypes.string,
};
