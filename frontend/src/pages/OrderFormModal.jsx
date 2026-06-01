import React, { useState } from "react";
import * as XLSX from "xlsx";
import "../styles/OrderFormModal.css";

export default function OrderFormModal({ isOpen, onClose, onOrderCreated }) {
  const [activeTab, setActiveTab] = useState("manual"); // "manual" | "excel"
  
  // Manual Form States
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [cargoName, setCargoName] = useState("");
  const [cargoWeight, setCargoWeight] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Excel Import States
  const [excelFile, setExcelFile] = useState(null);
  const [parsedOrders, setParsedOrders] = useState([]);
  const [excelError, setExcelError] = useState("");
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:9999";
  const token = localStorage.getItem("token");

  // Handle Manual Save
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!customerName.trim() || !customerPhone.trim() || !pickupAddress.trim() || !deliveryAddress.trim()) {
      setFormError("Vui lòng nhập đầy đủ các trường bắt buộc (*)");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_company: customerCompany,
          cargo_name: cargoName || "Hàng hóa tổng hợp",
          cargo_weight: cargoWeight ? parseFloat(cargoWeight) : 0,
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          estimated_price: estimatedPrice ? parseFloat(estimatedPrice) : 0,
          payment_type: paymentType,
          notes: notes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể tạo đơn hàng.");
      }

      // Reset form
      setCustomerName("");
      setCustomerPhone("");
      setCustomerCompany("");
      setCargoName("");
      setCargoWeight("");
      setPickupAddress("");
      setDeliveryAddress("");
      setEstimatedPrice("");
      setPaymentType("cash");
      setNotes("");

      if (onOrderCreated) onOrderCreated(data.order);
      onClose();
    } catch (err) {
      setFormError(err.message || "Đã xảy ra lỗi hệ thống.");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper mapping case-insensitive headers
  const getHeaderKey = (headerStr) => {
    if (!headerStr) return "";
    const h = headerStr.toString().toLowerCase().trim();
    if (h.includes("tên khách") || h.includes("khách hàng") || h.includes("customer name")) return "customer_name";
    if (h.includes("sđt") || h.includes("số điện thoại") || h.includes("sdt") || h.includes("phone")) return "customer_phone";
    if (h.includes("công ty") || h.includes("company")) return "customer_company";
    if (h.includes("tên hàng") || h.includes("hàng hóa") || h.includes("cargo name")) return "cargo_name";
    if (h.includes("khối lượng") || h.includes("nặng") || h.includes("weight")) return "cargo_weight";
    if (h.includes("địa chỉ lấy") || h.includes("pickup") || h.includes("nơi lấy")) return "pickup_address";
    if (h.includes("địa chỉ giao") || h.includes("delivery") || h.includes("nơi giao")) return "delivery_address";
    if (h.includes("giá trị") || h.includes("giá ước tính") || h.includes("estimated price")) return "estimated_price";
    if (h.includes("thanh toán") || h.includes("payment")) return "payment_type";
    if (h.includes("ghi chú") || h.includes("notes") || h.includes("note")) return "notes";
    return "";
  };

  // Parse Excel file
  const handleExcelUpload = (e) => {
    setExcelError("");
    setParsedOrders([]);
    const file = e.target.files[0];
    if (!file) return;

    setExcelFile(file);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert sheet to JSON array (row by row)
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) {
          throw new Error("Tệp Excel trống hoặc không có dòng dữ liệu hợp lệ.");
        }

        const headers = rows[0].map(h => getHeaderKey(h));
        
        const orders = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 0 || row.every(cell => cell === null || cell === "")) continue;

          const order = {};
          headers.forEach((key, index) => {
            if (key) {
              order[key] = row[index];
            }
          });

          // Validate required fields for UI warning
          if (!order.customer_name || !order.customer_phone || !order.pickup_address || !order.delivery_address) {
            order.hasError = true;
            order.errorMessage = "Thiếu trường bắt buộc (Tên khách hàng, SĐT, Nơi lấy, Nơi giao)";
          }

          // Format payment type
          if (order.payment_type) {
            const pay = order.payment_type.toString().toLowerCase().trim();
            if (pay.includes("tiền mặt") || pay.includes("cash")) order.payment_type = "cash";
            else if (pay.includes("chuyển khoản") || pay.includes("bank") || pay.includes("transfer")) order.payment_type = "bank_transfer";
            else if (pay.includes("công nợ") || pay.includes("debt")) order.payment_type = "debt";
            else order.payment_type = "cash";
          } else {
            order.payment_type = "cash";
          }

          orders.push(order);
        }

        if (orders.length === 0) {
          throw new Error("Không tìm thấy dòng dữ liệu nào hợp lệ trong tệp Excel.");
        }

        setParsedOrders(orders);
      } catch (err) {
        setExcelError(err.message || "Tệp Excel không đúng định dạng chuẩn.");
      }
    };

    reader.onerror = () => {
      setExcelError("Lỗi đọc file.");
    };

    reader.readAsBinaryString(file);
  };

  // Submit Excel list to backend
  const handleExcelSubmit = async () => {
    setExcelError("");
    const errorOrdersCount = parsedOrders.filter(o => o.hasError).length;
    if (errorOrdersCount > 0) {
      setExcelError(`Vui lòng sửa ${errorOrdersCount} dòng dữ liệu bị lỗi trước khi lưu.`);
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(`${API_BASE}/orders/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ orders: parsedOrders })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Nhập Excel thất bại.");
      }

      setExcelFile(null);
      setParsedOrders([]);
      if (onOrderCreated) onOrderCreated(); // Trigger reload all
      onClose();
    } catch (err) {
      setExcelError(err.message || "Đã xảy ra lỗi hệ thống khi import.");
    } finally {
      setImporting(false);
    }
  };

  // Download simple CSV/Excel template
  const downloadTemplate = () => {
    const templateData = [
      ["Tên khách hàng (*)", "Số điện thoại (*)", "Công ty khách hàng", "Tên hàng hóa", "Khối lượng (kg)", "Địa chỉ lấy hàng (*)", "Địa chỉ giao hàng (*)", "Giá trị ước tính (VND)", "Thanh toán (tiền mặt/chuyển khoản/công nợ)", "Ghi chú"],
      ["Nguyễn Văn A", "0912345678", "Công ty Kim khí", "Thép cuộn", "1500", "123 Cảng Cát Lái, Q2, TP.HCM", "456 Khu công nghiệp Amata, Đồng Nai", "30000000", "chuyển khoản", "Hàng nặng cần cẩu nâng"],
      ["Trần Thị B", "0987654321", "", "Trái cây đóng hộp", "200", "789 Đường Chợ Lớn, Q6, TP.HCM", "101 Đường Lê Lợi, Q1, TP.HCM", "5000000", "tiền mặt", "Hàng bảo quản lạnh"]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, "Template_Import");
    
    // Write out Excel file binary
    XLSX.writeFile(wb, "Template_Import_DonHang.xlsx");
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Tạo đơn hàng mới</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Tab Selection */}
        <div className="modal-tabs">
          <button 
            className={`tab-btn ${activeTab === "manual" ? "active" : ""}`}
            onClick={() => setActiveTab("manual")}
          >
            Nhập thủ công (Nhập tay)
          </button>
          <button 
            className={`tab-btn ${activeTab === "excel" ? "active" : ""}`}
            onClick={() => setActiveTab("excel")}
          >
            Nhập hàng loạt từ Excel
          </button>
        </div>

        {/* Tab Content: Manual */}
        {activeTab === "manual" && (
          <form onSubmit={handleManualSubmit} className="modal-form">
            <div className="form-grid">
              <label className="required">
                <span>Tên khách hàng (*)</span>
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)} 
                  placeholder="Nhập họ và tên..."
                  required
                />
              </label>

              <label className="required">
                <span>Số điện thoại (*)</span>
                <input 
                  type="tel" 
                  value={customerPhone} 
                  onChange={(e) => setCustomerPhone(e.target.value)} 
                  placeholder="Ví dụ: 0912345678"
                  required
                />
              </label>

              <label>
                <span>Tên công ty doanh nghiệp</span>
                <input 
                  type="text" 
                  value={customerCompany} 
                  onChange={(e) => setCustomerCompany(e.target.value)} 
                  placeholder="Không bắt buộc..."
                />
              </label>

              <label className="required">
                <span>Tên hàng hóa (*)</span>
                <input 
                  type="text" 
                  value={cargoName} 
                  onChange={(e) => setCargoName(e.target.value)} 
                  placeholder="Nhập mô tả hàng hóa..."
                  required
                />
              </label>

              <label>
                <span>Khối lượng hàng (kg)</span>
                <input 
                  type="number" 
                  value={cargoWeight} 
                  onChange={(e) => setCargoWeight(e.target.value)} 
                  placeholder="Ví dụ: 500"
                />
              </label>

              <label>
                <span>Giá trị ước tính (VND)</span>
                <input 
                  type="number" 
                  value={estimatedPrice} 
                  onChange={(e) => setEstimatedPrice(e.target.value)} 
                  placeholder="Ví dụ: 2500000"
                />
              </label>

              <label className="required full-width">
                <span>Địa chỉ lấy hàng (Điểm lấy) (*)</span>
                <input 
                  type="text" 
                  value={pickupAddress} 
                  onChange={(e) => setPickupAddress(e.target.value)} 
                  placeholder="Nhập số nhà, tên đường, quận/huyện, tỉnh/thành..."
                  required
                />
              </label>

              <label className="required full-width">
                <span>Địa chỉ giao hàng (Điểm giao) (*)</span>
                <input 
                  type="text" 
                  value={deliveryAddress} 
                  onChange={(e) => setDeliveryAddress(e.target.value)} 
                  placeholder="Nhập số nhà, tên đường, quận/huyện, tỉnh/thành..."
                  required
                />
              </label>

              <label className="full-width">
                <span>Phương thức thanh toán</span>
                <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                  <option value="cash">Tiền mặt (Cash)</option>
                  <option value="bank_transfer">Chuyển khoản (Bank Transfer)</option>
                  <option value="debt">Công nợ khách hàng (Debt)</option>
                </select>
              </label>

              <label className="full-width">
                <span>Ghi chú hành trình</span>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Hàng dễ vỡ, liên hệ trước khi đến,..."
                  rows={2}
                />
              </label>
            </div>

            {formError && <div className="error-message">{formError}</div>}

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={onClose}>Hủy bỏ</button>
              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? "Đang lưu..." : "Lưu đơn hàng"}
              </button>
            </div>
          </form>
        )}

        {/* Tab Content: Excel Import */}
        {activeTab === "excel" && (
          <div className="excel-import-tab">
            <div className="excel-instruction">
              <p>Tải danh sách đơn hàng hàng loạt bằng tệp mẫu Excel. Hãy đảm bảo các cột dữ liệu trùng khớp với tệp mẫu.</p>
              <button type="button" className="template-btn" onClick={downloadTemplate}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Tải file mẫu Excel (.xlsx)
              </button>
            </div>

            <div className="upload-box">
              <input 
                type="file" 
                id="excel-file-input"
                accept=".xlsx, .xls" 
                onChange={handleExcelUpload}
                style={{ display: "none" }}
              />
              <label htmlFor="excel-file-input" className="upload-label">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
                <span>{excelFile ? `Đã chọn: ${excelFile.name}` : "Kéo thả hoặc Nhấp để chọn tệp Excel"}</span>
              </label>
            </div>

            {excelError && <div className="error-message">{excelError}</div>}

            {parsedOrders.length > 0 && (
              <div className="preview-container">
                <div className="success-banner">
                  Đọc thành công <strong>{parsedOrders.length}</strong> đơn hàng từ file Excel. Vui lòng kiểm tra kỹ trước khi xác nhận.
                </div>
                <div className="table-wrapper">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>Khách hàng</th>
                        <th>SĐT</th>
                        <th>Tên hàng</th>
                        <th>Nơi lấy</th>
                        <th>Nơi giao</th>
                        <th>Khối lượng</th>
                        <th>Phương thức</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedOrders.map((o, idx) => (
                        <tr key={idx} className={o.hasError ? "row-error" : ""}>
                          <td>{o.customer_name || <em className="text-red">Bắt buộc</em>}</td>
                          <td>{o.customer_phone || <em className="text-red">Bắt buộc</em>}</td>
                          <td>{o.cargo_name || "Mặc định"}</td>
                          <td>{o.pickup_address || <em className="text-red">Bắt buộc</em>}</td>
                          <td>{o.delivery_address || <em className="text-red">Bắt buộc</em>}</td>
                          <td>{o.cargo_weight ? `${o.cargo_weight} kg` : "0 kg"}</td>
                          <td>
                            {o.payment_type === "cash" && "Tiền mặt"}
                            {o.payment_type === "bank_transfer" && "Chuyển khoản"}
                            {o.payment_type === "debt" && "Công nợ"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-actions mt-16">
              <button type="button" className="secondary-btn" onClick={onClose}>Hủy bỏ</button>
              <button 
                type="button" 
                className="primary-btn" 
                disabled={importing || parsedOrders.length === 0}
                onClick={handleExcelSubmit}
              >
                {importing ? "Đang xử lý..." : `Xác nhận lưu ${parsedOrders.length} đơn hàng`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
