import React, { useEffect, useState } from "react";
import "../../styles/Coordinator.css";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:9999";

const emptyForm = {
  date: "",
  check_in: "",
  plate: "",
  driver_id: "",
  pickup_address: "",
  delivery_address: "",
  estimated_price: "",
  customer_name: "",
  customer_phone: "",
  notes: "",
};

const requiredFields = [
  { key: "date", label: "Ngày" },
  { key: "check_in", label: "Chấm công" },
  { key: "plate", label: "BKS" },
  { key: "pickup_address", label: "Điểm lấy hàng" },
  { key: "delivery_address", label: "Điểm giao hàng" },
  { key: "estimated_price", label: "Cước xe" },
];

const parseNotes = (notes) => {
  const text = String(notes ?? "");
  const read = (label) => text.match(new RegExp(`${label}:\\s*([^|]+)`, "i"))?.[1]?.trim() || "";
  return {
    date: read("Ngày"),
    checkIn: read("Chấm công"),
    plate: read("BKS"),
    driverName: read("Lái xe"),
    pickup: read("Điểm lấy hàng"),
    delivery: read("Điểm giao hàng"),
    customer: read("Khách hàng"),
    customerPhone: read("SĐT"),
    revenue: read("Doanh thu"),
  };
};

export default function Coordinator({ user }) {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => {
      setMessage("");
      setMessageType("info");
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem("token");
        const [ordersResponse, driversResponse] = await Promise.all([
          fetch(`${apiBase}/api/orders`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }),
          fetch(`${apiBase}/api/drivers`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }),
        ]);

        const ordersData = await ordersResponse.json();
        const driversData = await driversResponse.json();

        if (!ordersResponse.ok) throw new Error(ordersData.error || "Không tải được danh sách đơn hàng.");
        if (!driversResponse.ok) throw new Error(driversData.error || "Không tải được danh sách tài xế.");

        setOrders(ordersData.orders || []);
        setDrivers(driversData.drivers || []);
      } catch (err) {
        setMessage(err.message || "Không tải được dữ liệu.");
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
  };

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (formErrors[key]) {
      setFormErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors[key];
        return nextErrors;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    requiredFields.forEach(({ key, label }) => {
      if (!String(form[key] ?? "").trim()) errors[key] = `${label} là thông tin bắt buộc`;
    });
    setFormErrors(errors);
    return errors;
  };

  const refreshOrders = async () => {
    const token = localStorage.getItem("token");
    const response = await fetch(`${apiBase}/api/orders`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Không tải được danh sách đơn hàng.");
    setOrders(data.orders || []);
  };

  const closeEditor = () => {
    setCreateOpen(false);
    setEditingOrderId(null);
    setForm(emptyForm);
    setFormErrors({});
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFormErrors({});
    setEditingOrderId(null);
    setCreateOpen(true);
  };

  const openEdit = (order) => {
    const notes = parseNotes(order.notes);
    setForm({
      date: notes.date || "",
      check_in: notes.checkIn || "",
      plate: notes.plate || "",
      driver_id: "",
      pickup_address: notes.pickup || order.pickup_address || "",
      delivery_address: notes.delivery || order.delivery_address || "",
      estimated_price: String(order.estimated_price ?? ""),
      customer_name: notes.customer || order.customer_name || "",
      customer_phone: notes.customerPhone || order.customer_phone || "",
      notes: String(order.notes ?? ""),
    });
    setEditingOrderId(order.id);
    setCreateOpen(true);
    setFormErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setMessageType("info");

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setMessage("Thiếu thông tin bắt buộc.");
      setMessageType("error");
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem("token");
      const selectedDriver = drivers.find((driver) => String(driver.id) === String(form.driver_id));
      const payload = {
        cargo_name: `${form.pickup_address} - ${form.delivery_address}`,
        cargo_weight_kg: null,
        pickup_address: form.pickup_address,
        delivery_address: form.delivery_address,
        estimated_price: form.estimated_price,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        notes: [
          `Ngày: ${form.date}`,
          `Chấm công: ${form.check_in}`,
          `BKS: ${form.plate}`,
          `Khách hàng: ${form.customer_name || ""}`,
          `SĐT: ${form.customer_phone || ""}`,
          `Lái xe: ${selectedDriver?.full_name || ""}`,
          `Điểm lấy hàng: ${form.pickup_address}`,
          `Điểm giao hàng: ${form.delivery_address}`,
        ].join(" | "),
      };

      const response = await fetch(
        editingOrderId ? `${apiBase}/api/orders/${editingOrderId}` : `${apiBase}/api/orders`,
        {
          method: editingOrderId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể lưu đơn hàng.");

      await refreshOrders();
      setMessage(data.message || (editingOrderId ? "Cập nhật đơn hàng thành công." : "Tạo đơn hàng thành công."));
      setMessageType("success");
      closeEditor();
    } catch (err) {
      setMessage(err.message || "Không thể lưu đơn hàng.");
      setMessageType("error");
    } finally {
      setCreating(false);
    }
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");
    setMessageType("info");
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiBase}/api/orders/import-excel`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import Excel thất bại.");

      await refreshOrders();
      setMessage(data.message || "Đã import Excel vào database.");
      setMessageType("success");
    } catch (err) {
      setMessage(err.message || "Không thể import Excel.");
      setMessageType("error");
    } finally {
      event.target.value = "";
    }
  };

  if (loading) {
    return <main className="loading-screen">Đang tải dữ liệu...</main>;
  }

  return (
    <div className="coordinator-shell coordinator-table-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">L</div>
            <div>
              <div className="brand-name">Logistics HQ</div>
              <div className="brand-sub">Coordinator dashboard</div>
            </div>
          </div>
          <nav className="nav">
            <button className="nav-item active">Đơn hàng</button>
            <button className="nav-item">Bản đồ</button>
            <button className="nav-item">Tài xế</button>
            <button className="nav-item">Báo cáo</button>
          </nav>
        </div>
        <button className="nav-item nav-footer" onClick={handleLogout}>Cá nhân</button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input placeholder="Tìm kiếm đơn hàng, ID, hành trình..." />
          </div>
          <div className="topbar-actions">
            <label className="import-btn">
              Import Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} hidden />
            </label>
            <button className="primary-btn" onClick={openCreate}>+ Tạo đơn hàng</button>
            <div className="avatar">{user?.full_name?.[0] || "A"}</div>
          </div>
        </header>

        <section className="hero">
          <div>
            <h1>Danh sách đơn hàng</h1>
            <p>Hiển thị toàn bộ dữ liệu từ database theo dạng bảng Excel.</p>
          </div>
        </section>

        {message && <div className={`notice notice-${messageType}`}>{message}</div>}

        <section className="spreadsheet-panel full-table-panel">
          <div className="panel-head">
            <div>
              <h2>Bảng đơn hàng</h2>
              <p>Ngày, chấm công, BKS, khách hàng, hành trình, tài xế, doanh thu.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ngày</th>
                  <th>Chấm công</th>
                  <th>BKS</th>
                  <th>Khách hàng</th>
                  <th>SĐT</th>
                  <th>Tài xế</th>
                  <th>Hành trình</th>
                  <th>Doanh thu</th>
                  <th>Completed At</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="11">Chưa có dữ liệu đơn hàng.</td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const notes = parseNotes(order.notes);
                    return (
                      <tr key={order.id}>
                        <td>#{order.id}</td>
                        <td>{notes.date || "-"}</td>
                        <td>{notes.checkIn || "-"}</td>
                        <td>{notes.plate || "-"}</td>
                        <td>{order.customer_name || notes.customer || "-"}</td>
                        <td>{order.customer_phone || notes.customerPhone || "-"}</td>
                        <td>{order.driver_name || notes.driverName || "-"}</td>
                        <td>{[order.pickup_address, order.delivery_address].filter(Boolean).join(" - ") || "-"}</td>
                        <td>{notes.revenue || order.estimated_price || "-"}</td>
                        <td>-</td>
                        <td>
                          <button className="table-edit-btn" onClick={() => openEdit(order)}>✎</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {createOpen && (
          <section className="modal-backdrop" onClick={closeEditor}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="panel-head">
                <div>
                  <h2>{editingOrderId ? "Sửa đơn hàng" : "Tạo đơn hàng"}</h2>
                  <p>{editingOrderId ? "Cập nhật theo kiểu Excel." : "Nhập nhanh rồi lưu thẳng vào database."}</p>
                </div>
                <button className="ghost-btn" onClick={closeEditor}>×</button>
              </div>

              <form className="create-form" onSubmit={handleSubmit}>
                <div className="sheet-caption full">Thông tin dòng</div>

                <label>
                  <span>Ngày</span>
                  <input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} className={formErrors.date ? "input-error" : ""} />
                  {formErrors.date && <div className="field-error">{formErrors.date}</div>}
                </label>
                <label>
                  <span>Chấm công</span>
                  <input value={form.check_in} onChange={(e) => updateField("check_in", e.target.value)} className={formErrors.check_in ? "input-error" : ""} />
                  {formErrors.check_in && <div className="field-error">{formErrors.check_in}</div>}
                </label>
                <label>
                  <span>BKS</span>
                  <input value={form.plate} onChange={(e) => updateField("plate", e.target.value)} className={formErrors.plate ? "input-error" : ""} />
                  {formErrors.plate && <div className="field-error">{formErrors.plate}</div>}
                </label>
                <label>
                  <span>Tài xế</span>
                  <select value={form.driver_id} onChange={(e) => updateField("driver_id", e.target.value)}>
                    <option value="">Chưa cần set</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Khách hàng</span>
                  <input value={form.customer_name} onChange={(e) => updateField("customer_name", e.target.value)} />
                </label>
                <label>
                  <span>SĐT</span>
                  <input value={form.customer_phone} onChange={(e) => updateField("customer_phone", e.target.value)} />
                </label>
                <label>
                  <span>Điểm lấy hàng</span>
                  <input value={form.pickup_address} onChange={(e) => updateField("pickup_address", e.target.value)} className={formErrors.pickup_address ? "input-error" : ""} />
                  {formErrors.pickup_address && <div className="field-error">{formErrors.pickup_address}</div>}
                </label>
                <label>
                  <span>Điểm giao hàng</span>
                  <input value={form.delivery_address} onChange={(e) => updateField("delivery_address", e.target.value)} className={formErrors.delivery_address ? "input-error" : ""} />
                  {formErrors.delivery_address && <div className="field-error">{formErrors.delivery_address}</div>}
                </label>
                <label>
                  <span>Cước xe</span>
                  <input type="number" min="0" step="1000" value={form.estimated_price} onChange={(e) => updateField("estimated_price", e.target.value)} className={formErrors.estimated_price ? "input-error" : ""} />
                  {formErrors.estimated_price && <div className="field-error">{formErrors.estimated_price}</div>}
                </label>
                <label className="wide">
                  <span>Ghi chú</span>
                  <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
                </label>

                {Object.keys(formErrors).length > 0 && (
                  <div className="full field-error field-error-box">
                    {requiredFields.map(({ key }) => formErrors[key]).filter(Boolean).map((err, index) => <div key={index}>{err}</div>)}
                  </div>
                )}

                <div className="form-actions full">
                  <button type="button" className="filter" onClick={closeEditor}>Hủy</button>
                  <button type="submit" className="primary-btn" disabled={creating}>{creating ? "Đang lưu..." : "Lưu"}</button>
                </div>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
