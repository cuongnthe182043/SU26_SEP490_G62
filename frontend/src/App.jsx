import React, { useEffect, useMemo, useState } from "react";
import Login from "./pages/Login";
import "./styles/Coordinator.css";

const defaultTrips = [
  {
    id: "#VL-8829",
    title: "Điện tử dễ vỡ",
    status: "Mới",
    pickup: "123 Nguyễn Huệ, Quận 1, TP.HCM",
    delivery: "456 Lê Lợi, Quận 3, TP.HCM",
    weight: "500kg",
    cargoType: "Điện tử",
  },
  {
    id: "#VL-9104",
    title: "Hàng dệt may số lượng lớn",
    status: "Đang chờ",
    pickup: "Kho hàng Tân Sơn Nhất",
    delivery: "789 Võ Văn Kiệt, Quận 5, TP.HCM",
    weight: "1,200kg",
    cargoType: "Phổ thông",
  },
  {
    id: "#VL-8842",
    title: "Vật tư y tế khẩn cấp",
    status: "Mới",
    pickup: "Phú Mỹ Hưng, Quận 7",
    delivery: "Thủ Thiêm, TP. Thủ Đức",
    weight: "150kg",
    cargoType: "Y tế",
  },
];

const sampleSpreadsheetRows = [
  {
    date: "04/05/2026",
    checkIn: "1",
    plate: "29H-961.45",
    driver: "Toàn",
    customer: "",
    route: "Xuân Đỉnh x4c",
    distance: "",
    fare: "1.400.000 đ",
    ticket: "",
    paid: "x",
    driverIncome: "1.400.000 đ",
    fuel: "",
    advance: "",
    note: "",
    revenue1: "",
    revenue2: "1.400.000 đ",
  },
  {
    date: "04/05/2026",
    checkIn: "",
    plate: "29H-961.45",
    driver: "Toàn",
    customer: "",
    route: "Hà Nội - Thanh Hóa",
    distance: "",
    fare: "3.000.000 đ",
    ticket: "",
    paid: "x",
    driverIncome: "3.000.000 đ",
    fuel: "",
    advance: "",
    note: "",
    revenue1: "",
    revenue2: "3.000.000 đ",
  },
];

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:9999";

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [trips, setTrips] = useState(defaultTrips);
  const [rows, setRows] = useState(sampleSpreadsheetRows);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return;
    try {
      setUser(JSON.parse(storedUser));
    } catch (err) {
      console.error("Failed to parse user data:", err);
    }
  }, []);

  const handleLoginSuccess = (userData) => setUser(userData);
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
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
    } catch (err) {
      setMessage(err.message || "Không thể import file Excel.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

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

        <button className="nav-item nav-footer" onClick={handleLogout}>
          Cá nhân
        </button>
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
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelImport}
                hidden
              />
            </label>
            <button className="primary-btn">+ Tạo đơn hàng</button>
            <div className="avatar">{user?.full_name?.[0] || "A"}</div>
          </div>
        </header>

        <section className="hero">
          <div>
            <h1>Danh sách đơn hàng</h1>
            <p>Quản lý và điều phối các chuyến vận chuyển đang hoạt động.</p>
          </div>
          <div className="filters">
            <button
              className={activeTab === "all" ? "filter active" : "filter"}
              onClick={() => setActiveTab("all")}
            >
              Tất cả đơn hàng
            </button>
            <button
              className={activeTab === "new" ? "filter active" : "filter"}
              onClick={() => setActiveTab("new")}
            >
              Mới (12)
            </button>
            <button
              className={activeTab === "waiting" ? "filter active" : "filter"}
              onClick={() => setActiveTab("waiting")}
            >
              Đang chờ (8)
            </button>
          </div>
        </section>

        {message && <div className="notice">{message}</div>}

        <section className="trip-grid">
          {filteredTrips.map((trip) => (
            <article className="trip-card" key={trip.id}>
              <div className="trip-head">
                <span className="trip-id">{trip.id}</span>
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
                  <span>Loại hàng</span>
                  <strong>{trip.cargoType}</strong>
                </div>
              </div>
              <div className="trip-actions">
                <button className="assign-btn">+ Phân công tài xế</button>
                <button className="ghost-btn">⋯</button>
              </div>
            </article>
          ))}
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
                  <th>Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
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
                    <td>{row.revenue2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
