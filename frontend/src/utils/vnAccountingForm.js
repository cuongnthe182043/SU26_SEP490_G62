/**
 * Khung định dạng biểu mẫu kế toán Việt Nam — dùng chung cho mọi file Excel xuất ra.
 *
 * Vì sao có file này: trước đây mỗi báo cáo tự vẽ tiêu đề theo một kiểu riêng —
 * "NHẬT KÝ TÀI CHÍNH" chữ xanh 18pt, "Kết quả kinh doanh — tháng 8/2026" chữ đen 14pt.
 * Đẹp, nhưng in ra không phải là chứng từ: thiếu khối định danh đơn vị, thiếu đơn vị
 * tính, và quan trọng nhất là thiếu chỗ ký. Kế toán không nộp được, không lưu trữ được,
 * và người nhận không biết ai chịu trách nhiệm về con số trong đó.
 *
 * Chuẩn áp dụng: chế độ kế toán doanh nghiệp theo **Thông tư 200/2014/TT-BTC** ngày
 * 22/12/2014 của Bộ Tài chính — bộ biểu mẫu mà phần lớn doanh nghiệp Việt Nam đang
 * dùng, và cũng là hệ thống tài khoản mà bảng financial_transactions đã dùng sẵn
 * (1111, 1121, 131, 1388, 334, 642, 3388...).
 *
 * Ba khối bắt buộc của một biểu mẫu:
 *   1. Khối định danh đơn vị (góc trên trái) + số hiệu mẫu (góc trên phải)
 *   2. Tên biểu mẫu ở giữa, kỳ báo cáo, đơn vị tính
 *   3. Khối ký ở cuối: ngày tháng + các chức danh chịu trách nhiệm
 */

export const BORDER_ARGB = "FF000000";
export const MONEY_FORMAT = "#,##0";
export const DATE_FORMAT = "dd/mm/yyyy";

const thin = { style: "thin", color: { argb: BORDER_ARGB } };
export const allBorders = { top: thin, left: thin, right: thin, bottom: thin };

/** Số hiệu mẫu theo Thông tư 200/2014/TT-BTC. */
export const TT200 = {
    NHAT_KY_CHUNG: {
        code: "Mẫu số S03a-DN",
        issued: "(Ban hành theo Thông tư số 200/2014/TT-BTC\nngày 22/12/2014 của Bộ Tài chính)",
    },
};

const setText = (ws, addr, value, font, alignment) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    if (font) cell.font = font;
    if (alignment) cell.alignment = alignment;
    return cell;
};

const colLetter = (n) => {
    let s = "";
    let x = n;
    while (x > 0) {
        const r = (x - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        x = Math.floor((x - 1) / 26);
    }
    return s;
};

/**
 * Khối 1 — định danh đơn vị bên trái, số hiệu mẫu bên phải.
 *
 * `form` để trống với báo cáo quản trị: chúng KHÔNG có số hiệu mẫu do Bộ Tài chính ban
 * hành, và in một số hiệu tự nghĩ ra lên đó là nói sai về tính pháp lý của tờ giấy.
 * Báo cáo quản trị vẫn giữ khối định danh đơn vị và khối ký — đó là phần làm nên một
 * văn bản chính thức của doanh nghiệp.
 *
 * @returns {number} chỉ số dòng trống kế tiếp
 */
export function drawEntityHeader(ws, { company = {}, form = null, colCount, startRow = 1 } = {}) {
    const right = Math.max(1, colCount - 2);
    const rightLetter = colLetter(right);
    const lastLetter = colLetter(colCount);

    const left = [
        `Đơn vị: ${company.company_name || "..................................................."}`,
        `Địa chỉ: ${company.address || "..................................................."}`,
        `Mã số thuế: ${company.tax_code || "..............................."}`,
    ];

    left.forEach((text, i) => {
        const r = startRow + i;
        ws.mergeCells(r, 1, r, Math.max(1, right - 1));
        setText(ws, `A${r}`, text,
            { size: 10, bold: i === 0 },
            { vertical: "middle", horizontal: "left" });
    });

    if (form) {
        ws.mergeCells(`${rightLetter}${startRow}:${lastLetter}${startRow}`);
        setText(ws, `${rightLetter}${startRow}`, form.code,
            { size: 10, bold: true },
            { vertical: "middle", horizontal: "center" });

        ws.mergeCells(`${rightLetter}${startRow + 1}:${lastLetter}${startRow + 2}`);
        setText(ws, `${rightLetter}${startRow + 1}`, form.issued,
            { size: 9, italic: true },
            { vertical: "middle", horizontal: "center", wrapText: true });
        ws.getRow(startRow + 1).height = 16;
        ws.getRow(startRow + 2).height = 16;
    }

    return startRow + left.length;
}

/**
 * Khối 2 — tên biểu mẫu, kỳ, đơn vị tính.
 *
 * "Đơn vị tính" nằm sát lề phải ngay trên bảng số liệu, đúng vị trí của biểu mẫu chuẩn.
 * Không có dòng này thì người đọc phải đoán con số là đồng, nghìn đồng hay triệu đồng.
 */
export function drawFormTitle(ws, { title, subtitle = null, period = null, unit = "đồng", colCount, startRow } = {}) {
    let r = startRow + 1;   // chừa một dòng trắng dưới khối định danh

    ws.mergeCells(r, 1, r, colCount);
    setText(ws, `A${r}`, String(title).toUpperCase(),
        { size: 15, bold: true },
        { vertical: "middle", horizontal: "center" });
    ws.getRow(r).height = 26;
    r += 1;

    if (period) {
        ws.mergeCells(r, 1, r, colCount);
        setText(ws, `A${r}`, period, { size: 11 }, { vertical: "middle", horizontal: "center" });
        r += 1;
    }
    if (subtitle) {
        ws.mergeCells(r, 1, r, colCount);
        setText(ws, `A${r}`, subtitle, { size: 10, italic: true }, { vertical: "middle", horizontal: "center" });
        r += 1;
    }
    if (unit) {
        const from = Math.max(1, colCount - 1);
        ws.mergeCells(r, from, r, colCount);
        setText(ws, `${colLetter(from)}${r}`, `Đơn vị tính: ${unit}`,
            { size: 10, italic: true },
            { vertical: "middle", horizontal: "right" });
        r += 1;
    }

    return r;
}

/**
 * Khối cuối của SỔ kế toán — hai dòng bắt buộc trước phần ký.
 * Chỉ áp cho sổ (nhật ký chung, sổ cái), không áp cho báo cáo.
 */
export function drawBookFooter(ws, { colCount, startRow, openedAt = null } = {}) {
    let r = startRow + 1;

    ws.mergeCells(r, 1, r, colCount);
    setText(ws, `A${r}`, "- Sổ này có .......... trang, đánh số từ trang số 01 đến trang ..........",
        { size: 10 }, { vertical: "middle", horizontal: "left" });
    r += 1;

    ws.mergeCells(r, 1, r, colCount);
    setText(ws, `A${r}`, `- Ngày mở sổ: ${openedAt || ".........................."}`,
        { size: 10 }, { vertical: "middle", horizontal: "left" });
    r += 1;

    return r;
}

/**
 * Khối 3 — ký duyệt.
 *
 * Chức danh mặc định theo biểu mẫu sổ kế toán: Người ghi sổ / Kế toán trưởng / Giám đốc.
 * Người đứng đầu ký kèm đóng dấu, hai vai còn lại chỉ ký và ghi rõ họ tên.
 *
 * Chừa 4 dòng trắng giữa chức danh và dòng "(Ký, họ tên)" — đó là chỗ ký tay thật khi
 * in ra. Không chừa thì tờ giấy in xong không ký vào đâu được.
 */
export function drawSignatureBlock(ws, {
    colCount,
    startRow,
    signers = ["Người ghi sổ", "Kế toán trưởng", "Giám đốc"],
    sealOnLast = true,
    signedOn = new Date(),
} = {}) {
    let r = startRow + 1;

    // Dòng ngày tháng, đặt trên cột chức danh cuối cùng
    const d = signedOn instanceof Date ? signedOn : new Date(signedOn);
    const dateText = Number.isNaN(d.getTime())
        ? "Ngày ....... tháng ....... năm ........."
        : `Ngày ${String(d.getDate()).padStart(2, "0")} tháng ${String(d.getMonth() + 1).padStart(2, "0")} năm ${d.getFullYear()}`;

    const span = Math.max(1, Math.floor(colCount / signers.length));
    const lastFrom = 1 + span * (signers.length - 1);
    ws.mergeCells(r, lastFrom, r, colCount);
    setText(ws, `${colLetter(lastFrom)}${r}`, dateText,
        { size: 10, italic: true }, { vertical: "middle", horizontal: "center" });
    r += 1;

    // Hàng chức danh
    signers.forEach((name, i) => {
        const from = 1 + span * i;
        const to = i === signers.length - 1 ? colCount : span * (i + 1);
        ws.mergeCells(r, from, r, Math.max(from, to));
        setText(ws, `${colLetter(from)}${r}`, name,
            { size: 10, bold: true }, { vertical: "middle", horizontal: "center" });
    });
    r += 1;

    // Hàng ghi chú cách ký
    signers.forEach((_, i) => {
        const from = 1 + span * i;
        const to = i === signers.length - 1 ? colCount : span * (i + 1);
        const note = sealOnLast && i === signers.length - 1 ? "(Ký, họ tên, đóng dấu)" : "(Ký, họ tên)";
        ws.mergeCells(r, from, r, Math.max(from, to));
        setText(ws, `${colLetter(from)}${r}`, note,
            { size: 9, italic: true }, { vertical: "middle", horizontal: "center" });
    });
    r += 1;

    // Chỗ trống để ký tay khi in
    for (let i = 0; i < 4; i += 1) {
        ws.getRow(r + i).height = 16;
    }
    return r + 4;
}

/** Đặt khổ in A4 + lặp lại dòng tiêu đề bảng ở mọi trang — sổ dài luôn in nhiều trang. */
export function setPrintLayout(ws, { landscape = true, headerRows = null } = {}) {
    ws.pageSetup = {
        paperSize: 9,                 // A4
        orientation: landscape ? "landscape" : "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
    if (headerRows) ws.pageSetup.printTitlesRow = headerRows;
    ws.headerFooter = { oddFooter: "&LTrang &P/&N&R&D &T" };
}

/** Tải workbook về máy với tên file gợi đúng nội dung. */
export async function downloadWorkbook(wb, fileName) {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}
