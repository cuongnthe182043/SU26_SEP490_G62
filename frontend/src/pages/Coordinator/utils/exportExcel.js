import ExcelJS from "exceljs";

const BRAND_BLUE = "FF2563EB";
const HEADER_TEXT = "FFFFFFFF";
const ZEBRA_FILL = "FFF8FAFC";
const BORDER_COLOR = "FFE2E8F0";
const thinBorder = { style: "thin", color: { argb: BORDER_COLOR } };

const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

/**
 * Export danh sách Đơn hàng ra Excel
 */
export async function exportCoordinatorOrdersToExcel(orders) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LogisCount";
  wb.created = new Date();

  const ws = wb.addWorksheet("DANH_SACH_DON_HANG", { views: [{ state: "frozen", ySplit: 1 }] });

  const HEADERS = [
    "STT", "Mã đơn", "Mã chuyến", "Ngày chạy", "Tên khách hàng", "SĐT khách hàng",
    "Tên hàng", "Khối lượng (kg)", "Biển số xe", "Điểm lấy hàng", "Điểm giao hàng",
    "Quãng đường (km)", "Cước xe (đ)", "Ứng trước (đ)", "Trạng thái", "Ghi chú"
  ];
  const MONEY_COLS = new Set(["Cước xe (đ)", "Ứng trước (đ)"]);

  ws.columns = HEADERS.map((h) => ({ header: h, key: h, width: Math.max(h.length + 3, 12) }));

  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };

  let totalFare = 0;
  let totalPrepaid = 0;
  let stt = 1;

  orders.forEach((o) => {
    // If order has sub-trips / shipments, export each shipment or order info
    const shipments = Array.isArray(o.trips) && o.trips.length > 0 ? o.trips : [o];
    shipments.forEach((s) => {
      const fare = Number(s.fare || s.price || o.fare || 0);
      const prepaid = Number(o.prepaidAmount || o.prepaid_amount || 0);
      const rowValues = [
        stt++,
        o.orderId ? `#${o.orderId}` : (o.order_id ? `#${o.order_id}` : ""),
        s.id ? `#${s.id}` : (s.shipment_id ? `#${s.shipment_id}` : ""),
        fmtDate(o.dateInput || o.date || s.run_date),
        o.customerName || o.customer_name || "",
        o.customerPhone || o.customer_phone || "",
        o.cargoName || o.cargo_name || "",
        o.cargoWeightKg || o.cargo_weight_kg || "",
        s.plate || s.vehicle_plate || o.plate || "",
        s.pickupAddress || s.pickup_address || o.pickupAddress || "",
        s.deliveryAddress || s.delivery_address || o.deliveryAddress || "",
        s.distance ?? o.distance ?? "",
        fare,
        prepaid,
        s.statusLabel || s.status || o.statusLabel || o.status || "",
        o.notes || o.note || ""
      ];

      const row = ws.addRow(rowValues);
      row.eachCell((cell, colNumber) => {
        const h = HEADERS[colNumber - 1];
        cell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };
        cell.alignment = {
          vertical: "middle",
          horizontal: MONEY_COLS.has(h) ? "right" : (h === "STT" || h === "Mã đơn" || h === "Mã chuyến" || h === "Ngày chạy" ? "center" : "left")
        };
        if (MONEY_COLS.has(h) && typeof cell.value === "number") cell.numFmt = "#,##0";
      });

      totalFare += fare;
      totalPrepaid += prepaid;
    });
  });

  // Total row
  const totalRow = ws.addRow([
    "", "", "", "", "", "", "", "", "", "", "", "TỔNG CỘNG",
    totalFare, totalPrepaid, "", ""
  ]);
  totalRow.eachCell((cell, colNumber) => {
    const h = HEADERS[colNumber - 1];
    cell.font = { bold: true };
    cell.border = { top: { style: "double", color: { argb: BORDER_COLOR } }, left: thinBorder, right: thinBorder, bottom: thinBorder };
    cell.alignment = { vertical: "middle", horizontal: MONEY_COLS.has(h) ? "right" : "left" };
    if (MONEY_COLS.has(h) && typeof cell.value === "number") cell.numFmt = "#,##0";
  });

  await saveWorkbook(wb, `Danh_Sach_Don_Hang_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export danh sách Phiếu thu / Yêu cầu phiếu thu ra Excel
 */
export async function exportCoordinatorReceiptsToExcel(receipts) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LogisCount";
  wb.created = new Date();

  const ws = wb.addWorksheet("DANH_SACH_PHIEU_THU", { views: [{ state: "frozen", ySplit: 1 }] });

  const HEADERS = [
    "STT", "Loại bản ghi", "Ngày tạo/yêu cầu", "Mã đơn", "Mã chuyến", "Tên khách hàng",
    "Tên tài xế", "Số tiền (đ)", "Trạng thái", "Ghi chú"
  ];
  const MONEY_COLS = new Set(["Số tiền (đ)"]);

  ws.columns = HEADERS.map((h) => ({ header: h, key: h, width: Math.max(h.length + 3, 14) }));

  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };

  let totalAmount = 0;

  receipts.forEach((r, idx) => {
    const amount = Number(r.record_kind === "receipt" ? r.receipt_amount : (r.actual_price || r.estimated_price || 0));
    const dateStr = r.receipt_created_at || r.requested_at;
    const formattedDate = dateStr ? new Date(dateStr).toLocaleString("vi-VN") : "";
    const kindText = r.record_kind === "receipt" ? "Phiếu thu" : "Yêu cầu";

    const rowValues = [
      idx + 1,
      kindText,
      formattedDate,
      r.order_id ? `#${r.order_id}` : "",
      r.shipment_id ? `#${r.shipment_id}` : (r.shipment_count ? `${r.shipment_count} chuyến` : ""),
      r.customer_name || "",
      r.driver_name || "",
      amount,
      r.status || "",
      r.coordinator_notes || r.notes || ""
    ];

    const row = ws.addRow(rowValues);
    row.eachCell((cell, colNumber) => {
      const h = HEADERS[colNumber - 1];
      cell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };
      cell.alignment = {
        vertical: "middle",
        horizontal: MONEY_COLS.has(h) ? "right" : (h === "STT" || h === "Loại bản ghi" || h === "Mã đơn" || h === "Mã chuyến" ? "center" : "left")
      };
      if (MONEY_COLS.has(h) && typeof cell.value === "number") cell.numFmt = "#,##0";
    });

    totalAmount += amount;
  });

  // Total row
  const totalRow = ws.addRow([
    "", "", "", "", "", "", "TỔNG CỘNG", totalAmount, "", ""
  ]);
  totalRow.eachCell((cell, colNumber) => {
    const h = HEADERS[colNumber - 1];
    cell.font = { bold: true };
    cell.border = { top: { style: "double", color: { argb: BORDER_COLOR } }, left: thinBorder, right: thinBorder, bottom: thinBorder };
    cell.alignment = { vertical: "middle", horizontal: MONEY_COLS.has(h) ? "right" : "left" };
    if (MONEY_COLS.has(h) && typeof cell.value === "number") cell.numFmt = "#,##0";
  });

  await saveWorkbook(wb, `Danh_Sach_Phieu_Thu_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export bảng chấm công ra Excel
 * Cấu trúc cột: STT, Họ và tên, Tháng, Ngày 1, Ngày 2, ..., Ngày N
 */
export async function exportAttendanceToExcel(drivers, month, year, statusLabels = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LogisCount";
  wb.created = new Date();

  const ws = wb.addWorksheet(`CHAM_CONG_T${month}_${year}`, { views: [{ state: "frozen", xSplit: 3, ySplit: 1 }] });

  // Định nghĩa màu sắc & ký hiệu cho từng trạng thái chấm công
  const STATUS_CONFIG = {
    present:          { symbol: "P",  name: "Có mặt",                   fgColor: "FFDCFCE7", textColor: "FF15803D" }, // Green
    leave_paid:       { symbol: "P",  name: "Nghỉ phép (hưởng lương)", textColor: "FF1D4ED8", fgColor: "FFDBEAFE" }, // Blue
    leave_unpaid:     { symbol: "KP", name: "Nghỉ không lương",        textColor: "FFB45309", fgColor: "FFFEEBC8" }, // Amber/Yellow
    absent_unexcused: { symbol: "V",  name: "Vắng không phép",         textColor: "FFBE123C", fgColor: "FFFCE7F3" }, // Rose/Red
    half_day:         { symbol: "1/2", name: "Nửa công (nghỉ nửa buổi)", textColor: "FFC2410C", fgColor: "FFFFEDD5" }, // Orange
  };

  // Tính số ngày trong tháng
  const daysInMonth = new Date(year, month, 0).getDate();

  // Tạo hàng tiêu đề
  const HEADERS = ["STT", "Họ và tên", "Tháng"];
  for (let d = 1; d <= daysInMonth; d++) {
    HEADERS.push(`Ngày ${d}`);
  }

  ws.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Họ và tên", key: "full_name", width: 25 },
    { header: "Tháng", key: "month", width: 12 },
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      header: `Ngày ${i + 1}`,
      key: `day_${i + 1}`,
      width: 10
    }))
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };
  });

  const formattedMonthStr = `${String(month).padStart(2, "0")}/${year}`;

  drivers.forEach((driver, idx) => {
    // Map trạng thái ngày theo object: { [dayNumber]: statusKey }
    const dayMap = {};
    if (Array.isArray(driver.days)) {
      driver.days.forEach((dayObj) => {
        const dNum = new Date(dayObj.work_date).getDate();
        dayMap[dNum] = dayObj.status || "present";
      });
    }

    const rowValues = [
      idx + 1,
      driver.full_name || "",
      formattedMonthStr,
    ];

    for (let d = 1; d <= daysInMonth; d++) {
      const statusCode = dayMap[d] || "present";
      const config = STATUS_CONFIG[statusCode] || STATUS_CONFIG.present;
      rowValues.push(config.symbol);
    }

    const row = ws.addRow(rowValues);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 1 || colNumber === 3 ? "center" : (colNumber > 3 ? "center" : "left")
      };

      if (colNumber > 3) {
        const d = colNumber - 3;
        const statusCode = dayMap[d] || "present";
        const config = STATUS_CONFIG[statusCode] || STATUS_CONFIG.present;

        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: config.fgColor } };
        cell.font = { bold: true, color: { argb: config.textColor }, size: 11 };
      } else if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA_FILL } };
      }
    });
  });

  // Ghi chú giải thích ký hiệu (Legend) bên dưới danh sách
  ws.addRow([]);
  const legendHeaderRow = ws.addRow(["Ghi chú ký hiệu chấm công:"]);
  legendHeaderRow.getCell(1).font = { bold: true, size: 11 };

  Object.values(STATUS_CONFIG).forEach((cfg) => {
    const legRow = ws.addRow([cfg.symbol, cfg.name]);
    legRow.height = 20;

    const symCell = legRow.getCell(1);
    symCell.alignment = { vertical: "middle", horizontal: "center" };
    symCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cfg.fgColor } };
    symCell.font = { bold: true, color: { argb: cfg.textColor } };
    symCell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };

    const nameCell = legRow.getCell(2);
    nameCell.alignment = { vertical: "middle", horizontal: "left" };
    nameCell.font = { size: 10 };
  });

  await saveWorkbook(wb, `Bang_Cham_Cong_T${month}_${year}.xlsx`);
}

async function saveWorkbook(wb, filename) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
