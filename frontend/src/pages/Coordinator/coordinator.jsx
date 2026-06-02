import React, { useEffect, useMemo, useState } from "react";
import "../../styles/Coordinator.css";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:9999";

const emptyForm = {
  date: "",
  check_in: "",
  plate: "",
  driver_id: "",
  customer_name: "",
  cargo_name: "",
  cargo_weight_kg: "",
  pickup_address: "",
  delivery_address: "",
  route_name: "",
  estimated_price: "",
  ticket: "",
  paid: false,
  driver_income: "",
  fuel: "",
  advance: "",
  note: "",
  revenue_1: "",
};

const requiredFields = [
  { key: "date", label: "Ngày" },
  { key: "check_in", label: "Chấm công" },
  { key: "plate", label: "BKS" },
  { key: "driver_id", label: "Lái xe" },
  { key: "route_name", label: "Hành trình" },
  { key: "estimated_price", label: "Cước xe" },
];

export default function Coordinator({ user }) {
  const [activeTab, setActiveTab] = useState("all");
  const [trips, setTrips] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rows, setRows] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    try {
      const storedTrips = localStorage.getItem("coordinatorTrips");
      if (storedTrips) {
        const parsedTrips = JSON.parse(storedTrips);
        if (Array.isArray(parsedTrips)) setTrips(parsedTrips);
      }
    } catch (error) {
      console.error("Failed to load trips:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("coordinatorTrips", JSON.stringify(trips));
  }, [trips]);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${apiBase}/api/orders`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Không tải được danh sách đơn hàng.");
        }

        const dbTrips = (data.orders || []).map((order) => ({
          id: `#${order.id}`,
          title: order.cargo_name,
          status: order.status === "pending" ? "Mới" : order.status,
          pickup: order.pickup_address,
          delivery: order.delivery_address,
          weight: `${order.cargo_weight_kg ?? ""}kg`,
          driverName: order.driver_name || extractDriverName(order.notes) || "",
        }));

        setTrips((currentTrips) => {
          const customTrips = currentTrips.filter((trip) => String(trip.id).startsWith("tmp-"));
          return [...dbTrips, ...customTrips];
        });
      } catch (error) {
        setMessage(error.message || "Không tải được danh sách đơn hàng.");
        setMessageType("error");
      }
    };

    loadOrders();
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => {
      setMessage("");
      setMessageType("info");
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${apiBase}/api/drivers`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await response.json();
        if (response.ok) {
          setDrivers(data.drivers || []);
        }
      } catch (error) {
        setMessage("Không tải được danh sách tài xế.");
        setMessageType("error");
      }
    };

    loadDrivers();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
  };

  const filteredTrips = useMemo(() => {
    if (activeTab === "all") return trips;
    return trips.filter((trip) =>
      activeTab === "new" ? trip.status === "Mới" : trip.status === "Đang chờ",
    );
  }, [activeTab, trips]);

  const handleExcelImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage("");
    setMessageType("info");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("token");
      const response = await fetch(`${apiBase}/api/coordinator/import-excel`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Import Excel failed.");
      }

      setRows(data.rows || []);
      setMessage(`Đã import ${data.rows?.length || 0} dòng từ Excel.`);
      setMessageType("success");
    } catch (err) {
      setMessage(err.message || "Không thể import file Excel.");
      setMessageType("error");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const validateForm = () => {
    const errors = {};
    requiredFields.forEach(({ key, label }) => {
      const value = String(form[key] ?? "").trim();
      if (!value) errors[key] = `${label} là thông tin bắt buộc`;
    });
    setFormErrors(errors);
    return errors;
  };

  const handleCreateOrder = async (event) => {
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
      const response = await fetch(`${apiBase}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          cargo_name: form.route_name,
          cargo_weight_kg: form.cargo_weight_kg,
          pickup_address: form.pickup_address,
          delivery_address: form.delivery_address,
          estimated_price: form.estimated_price,
          notes: [
            `Ngày: ${form.date}`,
            `Chấm công: ${form.check_in}`,
            `BKS: ${form.plate}`,
            `Lái xe: ${selectedDriver?.full_name || ""}`,
            `Khách hàng: ${form.customer_name || ""}`,
            `Hành trình: ${form.route_name}`,
            `Vé: ${form.ticket || ""}`,
            `KH đã thanh toán: ${form.paid ? "x" : ""}`,
            `Lái xe thu/chi: ${form.driver_income || ""}`,
            `Đổ dầu: ${form.fuel || ""}`,
            `Ứng lương: ${form.advance || ""}`,
            `Ghi chú: ${form.note || ""}`,
            `Doanh thu: ${form.revenue_1 || ""}`,
          ].join(" | "),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Không thể tạo đơn hàng.");
      }

      setTrips((currentTrips) => [
        {
          id: `tmp-${data.order.id}`,
          orderId: data.order.id,
          title: data.order.cargo_name,
          status: "Mới",
          pickup: data.order.pickup_address,
          delivery: data.order.delivery_address,
          weight: `${data.order.cargo_weight_kg ?? ""}kg`,
          driverName: selectedDriver?.full_name || extractDriverName(data.order.notes) || "",
        },
        ...currentTrips.filter((trip) => trip.orderId !== data.order.id),
      ]);
      setCreateOpen(false);
      setMessage(data.message || "Tạo đơn hàng thành công.");
      setMessageType("success");
      setForm(emptyForm);
      setFormErrors({});
    } catch (err) {
      setMessage(err.message || "Không thể tạo đơn hàng.");
      setMessageType("error");
    } finally {
      setCreating(false);
    }
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

  const extractDriverName = (notes) => {
    const match = String(notes ?? "").match(/Lái xe:\s*([^|]+)/i);
    return match?.[1]?.trim() || "";
  };

  return (
    <div className="coordinator-shell">
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
            <input placeholder="Tìm kiếm đơn hàng, ID, hoặc tuyến đường..." />
          </div>
          <div className="topbar-actions">
            <label className="import-btn">
              {importing ? "Đang import..." : "+ Import Excel"}
              <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} hidden />
            </label>
            <button className="primary-btn" onClick={() => setCreateOpen(true)}>+ Tạo đơn hàng</button>
            <div className="avatar">{user?.full_name?.[0] || "A"}</div>
          </div>
        </header>

        <section className="hero">
          <div>
            <h1>Danh sách đơn hàng</h1>
            <p>Quản lý và điều phối các chuyến vận chuyển đang hoạt động.</p>
          </div>
          <div className="filters">
            <button className={activeTab === "all" ? "filter active" : "filter"} onClick={() => setActiveTab("all")}>Tất cả đơn hàng</button>
            <button className={activeTab === "new" ? "filter active" : "filter"} onClick={() => setActiveTab("new")}>Mới</button>
            <button className={activeTab === "waiting" ? "filter active" : "filter"} onClick={() => setActiveTab("waiting")}>Đang chờ</button>
          </div>
        </section>

        {createOpen && (
          <section className="modal-backdrop" onClick={() => setCreateOpen(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="panel-head">
                <div>
                  <h2>Tạo đơn hàng</h2>
                  <p>Mẫu nhập bám theo file Excel, nhập nhanh theo từng cột.</p>
                </div>
                <button className="ghost-btn" onClick={() => setCreateOpen(false)}>×</button>
              </div>

              <form className="create-form" onSubmit={handleCreateOrder}>
                <div className="sheet-caption full">Thông tin dòng tạo đơn</div>
                <label>
                  <span>Ngày</span>
                  <input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} className={formErrors.date ? "input-error" : ""} />
                  {formErrors.date && <div className="field-error">{formErrors.date}</div>}
                </label>
                <label>
                  <span>Chấm công</span>
                  <input value={form.check_in} onChange={(e) => updateField("check_in", e.target.value)} placeholder="1" className={formErrors.check_in ? "input-error" : ""} />
                  {formErrors.check_in && <div className="field-error">{formErrors.check_in}</div>}
                </label>
                <label>
                  <span>BKS</span>
                  <input value={form.plate} onChange={(e) => updateField("plate", e.target.value)} placeholder="29H-961.45" className={formErrors.plate ? "input-error" : ""} />
                  {formErrors.plate && <div className="field-error">{formErrors.plate}</div>}
                </label>
                <label>
                  <span>Lái xe</span>
                  <select value={form.driver_id} onChange={(e) => updateField("driver_id", e.target.value)} className={formErrors.driver_id ? "input-error" : ""}>
                    <option value="">Chọn tài xế</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                    ))}
                  </select>
                  {formErrors.driver_id && <div className="field-error">{formErrors.driver_id}</div>}
                </label>
                <label>
                  <span>Khách hàng</span>
                  <input value={form.customer_name} onChange={(e) => updateField("customer_name", e.target.value)} />
                </label>
                <label className="wide">
                  <span>Hành trình</span>
                  <input value={form.route_name} onChange={(e) => updateField("route_name", e.target.value)} className={formErrors.route_name ? "input-error" : ""} required />
                  {formErrors.route_name && <div className="field-error">{formErrors.route_name}</div>}
                </label>
                <label>
                  <span>Quãng đường</span>
                  <input value={form.cargo_weight_kg} onChange={(e) => updateField("cargo_weight_kg", e.target.value)} placeholder="50" />
                </label>
                <label>
                  <span>Cước xe</span>
                  <input type="number" min="0" step="1000" value={form.estimated_price} onChange={(e) => updateField("estimated_price", e.target.value)} className={formErrors.estimated_price ? "input-error" : ""} />
                  {formErrors.estimated_price && <div className="field-error">{formErrors.estimated_price}</div>}
                </label>
                <label>
                  <span>Vé</span>
                  <input value={form.ticket} onChange={(e) => updateField("ticket", e.target.value)} />
                </label>
                <label>
                  <span>KH đã thanh toán</span>
                  <button
                    type="button"
                    className={form.paid ? "paid-toggle paid-toggle-on" : "paid-toggle"}
                    onClick={() => updateField("paid", !form.paid)}
                  >
                    {form.paid ? "Đã thanh toán" : "Chưa thanh toán"}
                  </button>
                </label>
                <label>
                  <span>Lái xe thu/chi</span>
                  <input value={form.driver_income} onChange={(e) => updateField("driver_income", e.target.value)} />
                </label>
                <label>
                  <span>Đổ dầu</span>
                  <input value={form.fuel} onChange={(e) => updateField("fuel", e.target.value)} />
                </label>
                <label>
                  <span>Ứng lương</span>
                  <input value={form.advance} onChange={(e) => updateField("advance", e.target.value)} />
                </label>
                <label className="wide">
                  <span>Ghi chú</span>
                  <textarea value={form.note} onChange={(e) => updateField("note", e.target.value)} />
                </label>
                <label>
                  <span>Điểm lấy hàng</span>
                  <input value={form.pickup_address} onChange={(e) => updateField("pickup_address", e.target.value)} />
                </label>
                <label>
                  <span>Điểm giao hàng</span>
                  <input value={form.delivery_address} onChange={(e) => updateField("delivery_address", e.target.value)} />
                </label>
                <label>
                  <span>Doanh thu</span>
                  <input value={form.revenue_1} onChange={(e) => updateField("revenue_1", e.target.value)} />
                </label>

                {Object.keys(formErrors).length > 0 && (
                  <div className="full field-error field-error-box">
                    {requiredFields
                      .filter(({ key }) => formErrors[key])
                      .map(({ label, key }) => (
                        <div key={key}>{formErrors[key] || `${label} là thông tin bắt buộc`}</div>
                      ))}
                  </div>
                )}

                <div className="form-actions full">
                  <button type="button" className="filter" onClick={() => setCreateOpen(false)}>Hủy</button>
                  <button type="submit" className="primary-btn" disabled={creating}>{creating ? "Đang tạo..." : "Tạo đơn"}</button>
                </div>
              </form>
            </div>
          </section>
        )}

        {message && <div className={`notice notice-${messageType}`}>{message}</div>}

        <section className="trip-grid">
          {filteredTrips.length === 0 ? (
            <article className="empty-state">
              <h3>Chưa có đơn hàng nào</h3>
              <p>Hãy tạo đơn mới hoặc import file Excel để nạp dữ liệu.</p>
            </article>
          ) : (
            filteredTrips.map((trip) => (
              <article className="trip-card" key={trip.id}>
                <div className="trip-head">
                  <span className="trip-id">#{trip.orderId || String(trip.id).replace(/^tmp-/, "")}</span>
                  <span className="trip-status">{trip.status}</span>
                </div>
                <h3>{trip.title}</h3>
                <div className="route-line">
                  <div className="point start" />
                  <div className="dashed" />
                  <div className="point end" />
                </div>
                <div className="trip-locations">
                  <div>
                    <span>ĐIỂM LẤY HÀNG</span>
                    <strong>{trip.pickup}</strong>
                  </div>
                  <div>
                    <span>ĐIỂM GIAO HÀNG</span>
                    <strong>{trip.delivery}</strong>
                  </div>
                </div>
                <div className="trip-meta">
                  <div>
                    <span>Khối lượng</span>
                    <strong>{trip.weight}</strong>
                  </div>
                  <div>
                    <span>Tài xế</span>
                    <strong>{trip.driverName || "Chưa phân công"}</strong>
                  </div>
                </div>
                <div className="trip-actions">
                  <button className="assign-btn">+ Phân công tài xế</button>
                  <button className="ghost-btn" aria-label="Chỉnh sửa đơn">✎</button>
                </div>
              </article>
            ))
          )}
        </section>

        <section className="spreadsheet-panel">
          <div className="panel-head">
            <div>
              <h2>Import từ Excel</h2>
              <p>Hỗ trợ file giống bảng tính bạn gửi, dùng để nạp dữ liệu nhanh.</p>
            </div>
            <div className="upload-hint">.xlsx / .xls</div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Chấm công</th>
                  <th>BKS</th>
                  <th>Lái xe</th>
                  <th>Khách hàng</th>
                  <th>Hành trình</th>
                  <th>Quãng đường</th>
                  <th>Cước xe</th>
                  <th>Vé</th>
                  <th>KH đã thanh toán</th>
                  <th>Lái xe thu/chi</th>
                  <th>Đổ dầu</th>
                  <th>Ứng lương</th>
                  <th>Ghi chú</th>
                  <th>Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="15">Chưa có dữ liệu Excel được import.</td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={`${row.date}-${index}`}>
                      <td>{row.date}</td>
                      <td>{row.checkIn}</td>
                      <td>{row.plate}</td>
                      <td>{row.driver}</td>
                      <td>{row.customer}</td>
                      <td>{row.route}</td>
                      <td>{row.distance}</td>
                      <td>{row.fare}</td>
                      <td>{row.ticket}</td>
                      <td>{row.paid}</td>
                      <td>{row.driverIncome}</td>
                      <td>{row.fuel}</td>
                      <td>{row.advance}</td>
                      <td>{row.note}</td>
                      <td>{row.revenue1}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
