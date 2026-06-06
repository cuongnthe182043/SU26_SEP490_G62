import React, { useState, useEffect } from "react";
import OrderFormModal from "./OrderFormModal";
import PaymentModal from "./PaymentModal";
import "../../styles/Orders.css";

export default function Accountant({ user, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Status filter for orders
  const [activeStatusFilter, setActiveStatusFilter] = useState("all"); // "all" | "pending" | "assigned" | "in_progress" | "completed" | "cancelled"
  // Debt status filter
  const [debtFilter, setDebtFilter] = useState("all"); // "all" | "unpaid" | "partial" | "paid"

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 6;

  // Stats State
  const [stats, setStats] = useState({
    total_revenue: 0,
    total_collected: 0,
    total_receivables: 0,
    pending_payments_count: 0
  });

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:9999";
  const token = localStorage.getItem("token");

  // Fetch finance statistics
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/accountant/finance/stats`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Không thể tải số liệu thống kê tài chính:", err);
    }
  };

  // Fetch orders from API with pagination
  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    try {
      let url = `${API_BASE}/accountant/orders?page=${currentPage}&limit=${itemsPerPage}`;
      const params = [];
      if (activeStatusFilter !== "all") {
        params.push(`status=${activeStatusFilter}`);
      }
      if (searchTerm.trim() !== "") {
        params.push(`search=${encodeURIComponent(searchTerm)}`);
      }
      if (params.length > 0) {
        url += `&${params.join("&")}`;
      }

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Không thể tải danh sách đơn hàng.");
      }

      const data = await response.json();
      
      if (data && data.orders) {
        setOrders(data.orders);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.totalItems || 0);
      } else {
        setOrders(Array.isArray(data) ? data : []);
        setTotalPages(1);
        setTotalItems(Array.isArray(data) ? data.length : 0);
      }
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra khi tải đơn hàng.");
    } finally {
      setLoading(false);
    }
  };

  // Refresh both orders and statistics
  const refreshData = () => {
    fetchOrders();
    fetchStats();
  };

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeStatusFilter, searchTerm, debtFilter]);

  // Fetch orders when page, status, or search changes
  useEffect(() => {
    refreshData();
  }, [activeStatusFilter, searchTerm, currentPage]);

  // Derived Category logic
  const getCargoType = (name) => {
    if (!name) return "Phổ thông";
    const n = name.toLowerCase();
    if (n.includes("điện tử") || n.includes("tivi") || n.includes("máy tính") || n.includes("điện thoại")) return "Điện tử";
    if (n.includes("y tế") || n.includes("thuốc") || n.includes("khẩu trang") || n.includes("vắc") || n.includes("vac")) return "Y tế";
    if (n.includes("dệt may") || n.includes("vải") || n.includes("quần áo") || n.includes("sợi")) return "Dệt may";
    if (n.includes("thực phẩm") || n.includes("trái cây") || n.includes("rau") || n.includes("thịt")) return "Thực phẩm";
    return "Phổ thông";
  };

  // Filter orders by debt status on client side for premium real-time reactive feel
  const filteredOrders = orders.filter(order => {
    if (debtFilter === "all") return true;
    const orderDebtStatus = order.debt_status || "unpaid";
    return orderDebtStatus === debtFilter;
  });

  return (
    <div className="dashboard-layout accountant-dashboard">
      {/* Sidebar - Finance & Logistics HQ */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg className="brand-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span className="brand-name">Finance HQ</span>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
              <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
            </svg>
            <span>Quản lý thu nợ</span>
          </button>
          
          <button className="nav-item" onClick={() => alert("Báo cáo tài chính & doanh thu đang phát triển!")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Báo cáo doanh thu</span>
          </button>

          <button className="nav-item" onClick={() => alert("Chức năng đối soát quỹ tài xế đang phát triển!")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
            <span>Đối soát quỹ tài xế</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="profile-btn" onClick={onLogout} title="Đăng xuất">
            <div className="profile-avatar">
              {user?.full_name ? user.full_name.charAt(0) : "A"}
            </div>
            <div className="profile-info">
              <span className="profile-name">{user?.full_name || "Trần Kế Toán"}</span>
              <span className="profile-role">Kế toán (Thu)</span>
            </div>
            <svg className="logout-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main-content">
        {/* Header Section */}
        <header className="main-header">
          <div className="search-bar">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input 
              type="text" 
              placeholder="Tìm khách hàng, số điện thoại, ID đơn hàng..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="header-actions">
            <button className="create-order-btn" onClick={() => setIsModalOpen(true)}>
              <span className="plus">+</span> Nhập đơn ngoài
            </button>

            <button className="icon-btn notification-bell" title="Thông báo" onClick={() => alert("Không có thông báo mới.")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="notification-badge"></span>
            </button>

            <div className="user-avatar" title={user?.email}>
              H
            </div>
          </div>
        </header>

        {/* Content Section */}
        <div className="content-body">
          <div className="page-header">
            <div>
              <h2>Quản lý thu nợ & Phiếu thu</h2>
              <p>Đối soát doanh thu các chuyến đi, theo dõi và ghi nhận công nợ của khách hàng.</p>
            </div>
          </div>

          {/* Finance Statistics Cards */}
          <div className="finance-stats-grid">
            <div className="finance-stat-card glass-blue">
              <div className="stat-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div className="stat-card-info">
                <span className="stat-card-label">Tổng doanh thu dự tính</span>
                <span className="stat-card-value">{Number(stats.total_revenue).toLocaleString()}đ</span>
              </div>
            </div>

            <div className="finance-stat-card glass-green">
              <div className="stat-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div className="stat-card-info">
                <span className="stat-card-label">Thực thu (Đã thu)</span>
                <span className="stat-card-value text-green">{Number(stats.total_collected).toLocaleString()}đ</span>
              </div>
            </div>

            <div className="finance-stat-card glass-red">
              <div className="stat-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div className="stat-card-info">
                <span className="stat-card-label">Công nợ phải thu</span>
                <span className="stat-card-value text-red">{Number(stats.total_receivables).toLocaleString()}đ</span>
              </div>
            </div>

            <div className="finance-stat-card glass-gold">
              <div className="stat-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="stat-card-info">
                <span className="stat-card-label">Số đơn chưa thu đủ</span>
                <span className="stat-card-value">{stats.pending_payments_count} đơn</span>
              </div>
            </div>
          </div>

          {/* Filters & Tabs */}
          <div className="filter-row">
            <div className="filter-tabs">
              <button 
                className={`filter-tab ${debtFilter === "all" ? "active" : ""}`}
                onClick={() => setDebtFilter("all")}
              >
                Tất cả công nợ
              </button>
              
              <button 
                className={`filter-tab ${debtFilter === "unpaid" ? "active" : ""}`}
                onClick={() => setDebtFilter("unpaid")}
              >
                Chưa thanh toán
              </button>

              <button 
                className={`filter-tab ${debtFilter === "partial" ? "active" : ""}`}
                onClick={() => setDebtFilter("partial")}
              >
                Thu một phần
              </button>

              <button 
                className={`filter-tab ${debtFilter === "paid" ? "active" : ""}`}
                onClick={() => setDebtFilter("paid")}
              >
                Đã thu đủ
              </button>
            </div>

            <div className="filter-subtabs">
              <select 
                className="select-status-filter"
                value={activeStatusFilter}
                onChange={(e) => setActiveStatusFilter(e.target.value)}
              >
                <option value="all">Tất cả trạng thái vận chuyển</option>
                <option value="pending">Mới tạo (Chưa điều phối)</option>
                <option value="assigned">Đã điều phối</option>
                <option value="in_progress">Đang vận chuyển</option>
                <option value="completed">Đã giao hàng</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}

          {/* Order Cards Grid */}
          {loading ? (
            <div className="loading-state">Đang tải danh sách đơn hàng nợ...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>
              </svg>
              <p>Không tìm thấy đơn hàng nào khớp với điều kiện lọc nợ.</p>
              <button className="create-order-btn mt-16" onClick={() => setIsModalOpen(true)}>Nhập đơn ngoài ngay</button>
            </div>
          ) : (
            <>
              <div className="order-grid">
                {filteredOrders.map((order) => {
                  const isPending = order.status === "pending";
                  const cargoType = getCargoType(order.cargo_name);
                  const orderDebtStatus = order.debt_status || "unpaid";
                  
                  // Calculate outstanding amount
                  const dueAmount = Number(order.debt_total || order.estimated_price || 0) - Number(order.debt_paid || 0);

                  return (
                    <div key={order.id} className="order-card">
                      {/* Card Header */}
                      <div className="card-header">
                        <span className="order-code">#VL-{order.id}</span>
                        <span className={`status-badge payment-${orderDebtStatus}`}>
                          {orderDebtStatus === "paid" && "Đã thu đủ"}
                          {orderDebtStatus === "partial" && "Thu một phần"}
                          {orderDebtStatus === "unpaid" && "Chưa thu"}
                        </span>
                      </div>

                      {/* Cargo Title */}
                      <h4 className="cargo-title">{order.cargo_name || "Hàng hóa tổng hợp"}</h4>

                      {/* Customer Info Section */}
                      <div className="customer-preview-box">
                        <span className="cust-name">{order.customer_name || "Khách lẻ"}</span>
                        <span className="cust-phone">📞 {order.customer_phone || "-"}</span>
                        {order.customer_company && (
                          <span className="cust-company">🏢 {order.customer_company}</span>
                        )}
                      </div>

                      {/* Timeline Path */}
                      <div className="timeline-path">
                        <div className="timeline-node start">
                          <div className="node-bullet blue"></div>
                          <div className="node-content">
                            <span className="node-label">LẤY HÀNG</span>
                            <span className="node-address">{order.pickup_address}</span>
                          </div>
                        </div>
                        
                        <div className="timeline-connector"></div>

                        <div className="timeline-node end">
                          <div className="node-bullet orange"></div>
                          <div className="node-content">
                            <span className="node-label">GIAO HÀNG</span>
                            <span className="node-address">{order.delivery_address}</span>
                          </div>
                        </div>
                      </div>

                      <div className="card-divider"></div>

                      {/* Financial & Weight Metadata grid */}
                      <div className="card-metadata-grid">
                        <div className="meta-box payment-type-box">
                          <div className="meta-details">
                            <span className="meta-label">Hình thức thanh toán</span>
                            <span className="meta-value">
                              {order.payment_type === "cash" && "💵 Tiền mặt"}
                              {order.payment_type === "bank_transfer" && "🏦 CK ngân hàng"}
                              {order.payment_type === "debt" && "📝 Công nợ khách"}
                            </span>
                          </div>
                        </div>

                        <div className="meta-box price-box">
                          <div className="meta-details">
                            <span className="meta-label">Tổng giá trị đơn</span>
                            <span className="meta-value font-bold">{Number(order.debt_total || order.estimated_price || 0).toLocaleString()}đ</span>
                          </div>
                        </div>

                        <div className="meta-box collected-box">
                          <div className="meta-details">
                            <span className="meta-label">Đã thu</span>
                            <span className="meta-value text-green font-bold">{Number(order.debt_paid || 0).toLocaleString()}đ</span>
                          </div>
                        </div>

                        <div className="meta-box due-box">
                          <div className="meta-details">
                            <span className="meta-label">Chưa thu</span>
                            <span className="meta-value text-red font-bold">{dueAmount.toLocaleString()}đ</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions Footer */}
                      <div className="card-actions">
                        <button 
                          className={`assign-btn ${orderDebtStatus === "paid" ? "history-only-btn" : "payment-action-btn"}`}
                          onClick={() => {
                            setSelectedOrderForPayment(order);
                            setIsPaymentModalOpen(true);
                          }}
                        >
                          <svg className="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="12" y1="4" x2="12" y2="20"/>
                          </svg>
                          {orderDebtStatus === "paid" ? "Lịch sử phiếu thu" : "Ghi nhận phiếu thu"}
                        </button>

                        <button 
                          className="action-square-btn" 
                          title="Xem chi tiết hành trình" 
                          onClick={() => alert(`Hành trình đơn hàng #VL-${order.id}:\n- Lấy hàng: ${order.pickup_address}\n- Giao hàng: ${order.delivery_address}\n- Khối lượng: ${order.cargo_weight || 0} kg\n- Trạng thái xe: ${isPending ? "Mới tạo" : "Đã gán vận chuyển"}\n- Ghi chú: ${order.notes || "Không có"}`)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="pagination-row">
                  <button 
                    className="pagination-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    &larr; Trang trước
                  </button>
                  
                  <div className="pagination-pages">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={pageNum}
                        className={`page-num-btn ${currentPage === pageNum ? "active" : ""}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button 
                    className="pagination-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    Trang sau &rarr;
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Floating Action Button (FAB) */}
      <button className="floating-action-btn" onClick={() => setIsModalOpen(true)} title="Tạo đơn hàng ngoài mới">
        <span className="plus">+</span> Nhập đơn ngoài
      </button>

      {/* Excel Import & Manual Entry Form Modal */}
      <OrderFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onOrderCreated={() => {
          refreshData();
        }}
      />

      {/* Accountant Payment Receipt Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        order={selectedOrderForPayment}
        onPaymentRecorded={() => {
          refreshData();
        }}
      />
    </div>
  );
}
