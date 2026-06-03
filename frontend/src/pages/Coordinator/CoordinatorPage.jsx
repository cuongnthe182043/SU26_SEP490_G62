import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../services/apiClient";
import "../../styles/Coordinator.css";

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
  { key: "date", label: "Date" },
  { key: "check_in", label: "Check in" },
  { key: "plate", label: "Plate" },
  { key: "driver_id", label: "Driver" },
  { key: "route_name", label: "Route" },
  { key: "estimated_price", label: "Price" },
];

function extractDriverName(notes) {
  const match = String(notes ?? "").match(/Lai xe:\s*([^|]+)/i);
  return match?.[1]?.trim() || "";
}

function buildTripFromOrder(order) {
  return {
    id: `#${order.id}`,
    title: order.cargo_name,
    status: order.status === "pending" ? "New" : order.status,
    pickup: order.pickup_address,
    delivery: order.delivery_address,
    weight: `${order.cargo_weight_kg ?? ""}kg`,
    driverName: order.driver_name || extractDriverName(order.notes) || "",
  };
}

export default function CoordinatorPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
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
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    try {
      const storedTrips = localStorage.getItem("coordinatorTrips");
      if (!storedTrips) return;

      const parsedTrips = JSON.parse(storedTrips);
      if (Array.isArray(parsedTrips)) {
        setTrips(parsedTrips);
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
        const data = await apiRequest("/api/orders", { token });
        const dbTrips = (data.orders || []).map(buildTripFromOrder);

        setTrips((currentTrips) => {
          const customTrips = currentTrips.filter((trip) => String(trip.id).startsWith("tmp-"));
          return [...dbTrips, ...customTrips];
        });
      } catch (error) {
        setMessage(error.message || "Unable to load order list.");
        setMessageType("error");
      }
    };

    loadOrders();
  }, []);

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const token = localStorage.getItem("token");
        const data = await apiRequest("/api/drivers", { token });
        setDrivers(data.drivers || []);
      } catch (error) {
        setMessage("Unable to load driver list.");
        setMessageType("error");
      }
    };

    loadDrivers();
  }, []);

  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(() => {
      setMessage("");
      setMessageType("info");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [message]);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
  };

  const filteredTrips = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return trips.filter((trip) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "new" && trip.status === "New") ||
        (activeTab === "waiting" && trip.status === "Waiting");

      if (!matchesTab) return false;
      if (!query) return true;

      return [trip.id, trip.title, trip.pickup, trip.delivery, trip.driverName, trip.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [activeTab, deferredSearchQuery, trips]);

  const validateForm = () => {
    const errors = {};

    requiredFields.forEach(({ key, label }) => {
      const value = String(form[key] ?? "").trim();
      if (!value) {
        errors[key] = `${label} is required`;
      }
    });

    setFormErrors(errors);
    return errors;
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
      const data = await apiRequest("/api/coordinator/import-excel", {
        method: "POST",
        token,
        body: formData,
      });

      setRows(data.rows || []);
      setMessage(`Imported ${data.rows?.length || 0} rows from Excel.`);
      setMessageType("success");
    } catch (err) {
      setMessage(err.message || "Unable to import Excel file.");
      setMessageType("error");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const handleCreateOrder = async (event) => {
    event.preventDefault();
    setMessage("");
    setMessageType("info");

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setMessage("Missing required fields.");
      setMessageType("error");
      return;
    }

    setCreating(true);

    try {
      const token = localStorage.getItem("token");
      const selectedDriver = drivers.find(
        (driver) => String(driver.id) === String(form.driver_id),
      );

      const data = await apiRequest("/api/orders", {
        method: "POST",
        token,
        body: {
          cargo_name: form.route_name,
          cargo_weight_kg: form.cargo_weight_kg,
          pickup_address: form.pickup_address,
          delivery_address: form.delivery_address,
          estimated_price: form.estimated_price,
          notes: [
            `Ngay: ${form.date}`,
            `Cham cong: ${form.check_in}`,
            `BKS: ${form.plate}`,
            `Lai xe: ${selectedDriver?.full_name || ""}`,
            `Khach hang: ${form.customer_name || ""}`,
            `Hanh trinh: ${form.route_name}`,
            `Ve: ${form.ticket || ""}`,
            `KH da thanh toan: ${form.paid ? "x" : ""}`,
            `Lai xe thu/chi: ${form.driver_income || ""}`,
            `Do dau: ${form.fuel || ""}`,
            `Ung luong: ${form.advance || ""}`,
            `Ghi chu: ${form.note || ""}`,
            `Doanh thu: ${form.revenue_1 || ""}`,
          ].join(" | "),
        },
      });

      setTrips((currentTrips) => [
        {
          id: `tmp-${data.order.id}`,
          orderId: data.order.id,
          title: data.order.cargo_name,
          status: "New",
          pickup: data.order.pickup_address,
          delivery: data.order.delivery_address,
          weight: `${data.order.cargo_weight_kg ?? ""}kg`,
          driverName: selectedDriver?.full_name || extractDriverName(data.order.notes) || "",
        },
        ...currentTrips.filter((trip) => trip.orderId !== data.order.id),
      ]);

      setCreateOpen(false);
      setMessage(data.message || "Order created successfully.");
      setMessageType("success");
      setForm(emptyForm);
      setFormErrors({});
    } catch (err) {
      setMessage(err.message || "Unable to create order.");
      setMessageType("error");
    } finally {
      setCreating(false);
    }
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
            <button className="nav-item active">Orders</button>
            <button className="nav-item">Map</button>
            <button className="nav-item">Drivers</button>
            <button className="nav-item">Reports</button>
          </nav>
        </div>
        <button className="nav-item nav-footer" onClick={handleLogout}>
          Profile
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search order, ID, or route..."
            />
          </div>
          <div className="topbar-actions">
            <label className="import-btn">
              {importing ? "Importing..." : "+ Import Excel"}
              <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} hidden />
            </label>
            <button className="primary-btn" onClick={() => setCreateOpen(true)}>
              + Create order
            </button>
            <div className="avatar">{user?.full_name?.[0] || "A"}</div>
          </div>
        </header>

        <section className="hero">
          <div>
            <h1>Order list</h1>
            <p>Manage and dispatch active transport trips.</p>
          </div>
          <div className="filters">
            <button
              className={activeTab === "all" ? "filter active" : "filter"}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>
            <button
              className={activeTab === "new" ? "filter active" : "filter"}
              onClick={() => setActiveTab("new")}
            >
              New
            </button>
            <button
              className={activeTab === "waiting" ? "filter active" : "filter"}
              onClick={() => setActiveTab("waiting")}
            >
              Waiting
            </button>
          </div>
        </section>

        {createOpen && (
          <section className="modal-backdrop" onClick={() => setCreateOpen(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <div>
                  <h2>Create order</h2>
                  <p>Fill the form based on the Excel sheet structure.</p>
                </div>
                <button className="ghost-btn" onClick={() => setCreateOpen(false)}>
                  x
                </button>
              </div>

              <form className="create-form" onSubmit={handleCreateOrder}>
                <div className="sheet-caption full">Order row information</div>
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => updateField("date", event.target.value)}
                    className={formErrors.date ? "input-error" : ""}
                  />
                  {formErrors.date && <div className="field-error">{formErrors.date}</div>}
                </label>
                <label>
                  <span>Check in</span>
                  <input
                    value={form.check_in}
                    onChange={(event) => updateField("check_in", event.target.value)}
                    placeholder="1"
                    className={formErrors.check_in ? "input-error" : ""}
                  />
                  {formErrors.check_in && (
                    <div className="field-error">{formErrors.check_in}</div>
                  )}
                </label>
                <label>
                  <span>Plate</span>
                  <input
                    value={form.plate}
                    onChange={(event) => updateField("plate", event.target.value)}
                    placeholder="29H-961.45"
                    className={formErrors.plate ? "input-error" : ""}
                  />
                  {formErrors.plate && <div className="field-error">{formErrors.plate}</div>}
                </label>
                <label>
                  <span>Driver</span>
                  <select
                    value={form.driver_id}
                    onChange={(event) => updateField("driver_id", event.target.value)}
                    className={formErrors.driver_id ? "input-error" : ""}
                  >
                    <option value="">Choose driver</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.full_name}
                      </option>
                    ))}
                  </select>
                  {formErrors.driver_id && (
                    <div className="field-error">{formErrors.driver_id}</div>
                  )}
                </label>
                <label>
                  <span>Customer</span>
                  <input
                    value={form.customer_name}
                    onChange={(event) => updateField("customer_name", event.target.value)}
                  />
                </label>
                <label className="wide">
                  <span>Route</span>
                  <input
                    value={form.route_name}
                    onChange={(event) => updateField("route_name", event.target.value)}
                    className={formErrors.route_name ? "input-error" : ""}
                    required
                  />
                  {formErrors.route_name && (
                    <div className="field-error">{formErrors.route_name}</div>
                  )}
                </label>
                <label>
                  <span>Weight</span>
                  <input
                    value={form.cargo_weight_kg}
                    onChange={(event) => updateField("cargo_weight_kg", event.target.value)}
                    placeholder="50"
                  />
                </label>
                <label>
                  <span>Price</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={form.estimated_price}
                    onChange={(event) => updateField("estimated_price", event.target.value)}
                    className={formErrors.estimated_price ? "input-error" : ""}
                  />
                  {formErrors.estimated_price && (
                    <div className="field-error">{formErrors.estimated_price}</div>
                  )}
                </label>
                <label>
                  <span>Ticket</span>
                  <input
                    value={form.ticket}
                    onChange={(event) => updateField("ticket", event.target.value)}
                  />
                </label>
                <label>
                  <span>Paid</span>
                  <button
                    type="button"
                    className={form.paid ? "paid-toggle paid-toggle-on" : "paid-toggle"}
                    onClick={() => updateField("paid", !form.paid)}
                  >
                    {form.paid ? "Paid" : "Unpaid"}
                  </button>
                </label>
                <label>
                  <span>Driver income</span>
                  <input
                    value={form.driver_income}
                    onChange={(event) => updateField("driver_income", event.target.value)}
                  />
                </label>
                <label>
                  <span>Fuel</span>
                  <input
                    value={form.fuel}
                    onChange={(event) => updateField("fuel", event.target.value)}
                  />
                </label>
                <label>
                  <span>Advance</span>
                  <input
                    value={form.advance}
                    onChange={(event) => updateField("advance", event.target.value)}
                  />
                </label>
                <label className="wide">
                  <span>Note</span>
                  <textarea
                    value={form.note}
                    onChange={(event) => updateField("note", event.target.value)}
                  />
                </label>
                <label>
                  <span>Pickup</span>
                  <input
                    value={form.pickup_address}
                    onChange={(event) => updateField("pickup_address", event.target.value)}
                  />
                </label>
                <label>
                  <span>Delivery</span>
                  <input
                    value={form.delivery_address}
                    onChange={(event) => updateField("delivery_address", event.target.value)}
                  />
                </label>
                <label>
                  <span>Revenue</span>
                  <input
                    value={form.revenue_1}
                    onChange={(event) => updateField("revenue_1", event.target.value)}
                  />
                </label>

                {Object.keys(formErrors).length > 0 && (
                  <div className="full field-error field-error-box">
                    {requiredFields
                      .filter(({ key }) => formErrors[key])
                      .map(({ label, key }) => (
                        <div key={key}>{formErrors[key] || `${label} is required`}</div>
                      ))}
                  </div>
                )}

                <div className="form-actions full">
                  <button type="button" className="filter" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={creating}>
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {message && <div className={`notice notice-${messageType}`}>{message}</div>}

        <section className="trip-grid">
          {filteredTrips.length === 0 ? (
            <article className="empty-state">
              <h3>No orders yet</h3>
              <p>Create an order or import an Excel file to load data.</p>
            </article>
          ) : (
            filteredTrips.map((trip) => (
              <article className="trip-card" key={trip.id}>
                <div className="trip-head">
                  <span className="trip-id">
                    #{trip.orderId || String(trip.id).replace(/^tmp-/, "")}
                  </span>
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
                    <span>Pickup</span>
                    <strong>{trip.pickup}</strong>
                  </div>
                  <div>
                    <span>Delivery</span>
                    <strong>{trip.delivery}</strong>
                  </div>
                </div>
                <div className="trip-meta">
                  <div>
                    <span>Weight</span>
                    <strong>{trip.weight}</strong>
                  </div>
                  <div>
                    <span>Driver</span>
                    <strong>{trip.driverName || "Unassigned"}</strong>
                  </div>
                </div>
                <div className="trip-actions">
                  <button className="assign-btn">+ Assign driver</button>
                  <button className="ghost-btn" aria-label="Edit order">
                    ✎
                  </button>
                </div>
              </article>
            ))
          )}
        </section>

        <section className="spreadsheet-panel">
          <div className="panel-head">
            <div>
              <h2>Excel import</h2>
              <p>Upload the spreadsheet template to batch import data.</p>
            </div>
            <div className="upload-hint">.xlsx / .xls</div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check in</th>
                  <th>Plate</th>
                  <th>Driver</th>
                  <th>Customer</th>
                  <th>Route</th>
                  <th>Weight</th>
                  <th>Price</th>
                  <th>Ticket</th>
                  <th>Paid</th>
                  <th>Driver income</th>
                  <th>Fuel</th>
                  <th>Advance</th>
                  <th>Note</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="15">No imported Excel rows yet.</td>
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
