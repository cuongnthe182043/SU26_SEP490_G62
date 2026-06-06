import React, { useState, useEffect } from "react";
import "../../styles/PaymentModal.css";

export default function PaymentModal({ isOpen, onClose, order, onPaymentRecorded }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [paymentsList, setPaymentsList] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:9999";
  const token = localStorage.getItem("token");

  // Remaining unpaid debt amount
  const remaining = order ? Number(order.debt_total || order.estimated_price || 0) - Number(order.debt_paid || 0) : 0;

  useEffect(() => {
    if (isOpen && order) {
      setAmount(remaining > 0 ? remaining : "");
      setPaymentMethod("cash");
      setNotes("");
      setError("");
      fetchPaymentsHistory();
    }
  }, [isOpen, order]);

  const fetchPaymentsHistory = async () => {
    if (!order) return;
    setLoadingPayments(true);
    try {
      const response = await fetch(`${API_BASE}/accountant/orders/${order.id}/payments`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPaymentsList(data);
      }
    } catch (err) {
      console.error("Không thể tải lịch sử thanh toán:", err);
    } finally {
      setLoadingPayments(false);
    }
  };

  if (!isOpen || !order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Vui lòng nhập số tiền thanh toán hợp lệ (phải lớn hơn 0).");
      return;
    }

    if (numericAmount > remaining + 0.01) {
      setError(`Số tiền vượt quá dư nợ còn lại (${remaining.toLocaleString()}đ).`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/accountant/orders/${order.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: numericAmount,
          paymentMethod,
          notes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ghi nhận thanh toán thất bại.");
      }

      if (onPaymentRecorded) {
        onPaymentRecorded();
      }
      onClose();
    } catch (err) {
      setError(err.message || "Đã xảy ra lỗi hệ thống.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="accountant-modal-overlay">
      <div className="accountant-modal-card payment-modal-card">
        <div className="accountant-modal-header">
          <div>
            <h3>Ghi nhận Phiếu thu (Thanh toán)</h3>
            <span className="order-subtitle">Đơn hàng #VL-{order.id} &bull; Khách hàng: {order.customer_name}</span>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Debt Status Summary Card */}
        <div className="debt-summary-box">
          <div className="summary-item">
            <span className="summary-lbl">Tổng giá trị đơn</span>
            <span className="summary-val">{Number(order.debt_total || order.estimated_price || 0).toLocaleString()}đ</span>
          </div>
          <div className="summary-item">
            <span className="summary-lbl">Đã thu</span>
            <span className="summary-val text-green">{Number(order.debt_paid || 0).toLocaleString()}đ</span>
          </div>
          <div className="summary-item">
            <span className="summary-lbl">Còn phải thu</span>
            <span className="summary-val text-red">{remaining.toLocaleString()}đ</span>
          </div>
        </div>

        {remaining <= 0 ? (
          <div className="success-banner text-center mb-16">
            🎉 Đơn hàng này đã được thu đủ toàn bộ số tiền!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="accountant-modal-form">
            <div className="form-grid">
              <label className="required full-width">
                <span>Số tiền ghi thu (VND) (*)</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Ví dụ: ${remaining}`}
                  max={remaining}
                  required
                />
              </label>

              <label className="full-width">
                <span>Phương thức thu tiền</span>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="cash">Tiền mặt (Cash)</option>
                  <option value="bank_transfer">Chuyển khoản ngân hàng (Bank Transfer)</option>
                </select>
              </label>

              <label className="full-width">
                <span>Ghi chú chứng từ</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mã chuyển khoản, người nộp tiền, số hóa đơn..."
                  rows={2}
                />
              </label>
            </div>

            {error && <div className="error-message mb-16">{error}</div>}

            <div className="accountant-modal-actions mb-24">
              <button type="button" className="secondary-btn" onClick={onClose}>Hủy</button>
              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? "Đang ghi thu..." : `Xác nhận thu ${Number(amount || 0).toLocaleString()}đ`}
              </button>
            </div>
          </form>
        )}

        {/* Lịch sử thanh toán */}
        <div className="payments-history-section">
          <h4>Lịch sử các lần thu tiền</h4>
          {loadingPayments ? (
            <div className="loading-small">Đang tải lịch sử...</div>
          ) : paymentsList.length === 0 ? (
            <div className="empty-small">Chưa có phiếu thu nào được ghi nhận cho đơn này.</div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Ngày thu</th>
                    <th>Số tiền</th>
                    <th>Phương thức</th>
                    <th>Ghi chú</th>
                    <th>Người lập</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsList.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.paid_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="font-bold text-green">+{Number(p.amount).toLocaleString()}đ</td>
                      <td>{p.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản"}</td>
                      <td className="text-muted">{p.notes || "-"}</td>
                      <td>{p.creator_name || "Hệ thống"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
