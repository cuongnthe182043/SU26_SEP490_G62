const coordinatorService = require('../services/coordinatorService');
const expenseRepository  = require('../repositories/expenseRepository');
const { validateExpenseReceipt } = require('../services/expenseAiValidator');

const listVehicleGroups = async (_req, res) => {
  try {
    const vehicleGroups = await coordinatorService.listVehicleGroups();
    res.json({ vehicleGroups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const listPartners = async (_req, res) => {
  try {
    const partners = await coordinatorService.listPartners();
    res.json({ partners });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getIncidents = async (req, res) => {
    try {
        const { status, severity_level, search, sort, page, limit } = req.query;
        const result = await coordinatorService.getIncidents({
            status: status || null,
            severityLevel: severity_level || null,
            search: search || '',
            sort: sort || 'newest',
            page: page,
            limit: limit,
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/coordinator/receipt-requests?status=pending
const getReceiptRequests = async (req, res) => {
    try {
        const { status, kind, search, dateFrom, dateTo, sort, page, limit } = req.query;
        const result = await coordinatorService.getReceiptRequests({
            status: status || null,
            kind: kind || 'all',
            search: search || '',
            dateFrom: dateFrom || '',
            dateTo: dateTo || '',
            sort: sort || null,
            page: page,
            limit: limit,
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/coordinator/receipt-requests/:id
const getReceiptRequestDetail = async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        if (!requestId) return res.status(400).json({ error: 'Request ID không hợp lệ' });
        const detail = await coordinatorService.getReceiptRequestDetail(requestId);
        res.json(detail);
    } catch (err) {
        const code = err.message.includes('không tồn tại') ? 404 : 500;
        res.status(code).json({ error: err.message });
    }
};

// POST /api/coordinator/receipt-requests/:id/approve
// Body: { notes?, expenses?[], priceOverride? } — priceOverride chốt giá cước khác gợi ý km×đơn giá
const approveReceiptRequest = async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        if (!requestId) return res.status(400).json({ error: 'Request ID không hợp lệ' });
        const receipt = await coordinatorService.approveReceiptRequest(
            requestId, req.user.userId, req.body,
        );
        res.status(201).json({ message: 'Đã tạo phiếu thu thành công', receipt });
    } catch (err) {
        const code = err.message.includes('không tồn tại') ? 404
            : err.message.includes('đã được duyệt') || err.message.includes('đã bị từ chối') ? 409
            : err.message.includes('không hợp lệ') || err.message.includes('lớn hơn 0')
                || err.message.includes('chưa được xác nhận') || err.message.includes('chưa có số km')
                || err.message.includes('chưa duyệt hoặc từ chối') ? 422
            : 500;
        res.status(code).json({ error: err.message });
    }
};

// POST /api/coordinator/receipt-requests/:id/reject
// Body: { notes? }
const rejectReceiptRequest = async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        if (!requestId) return res.status(400).json({ error: 'Request ID không hợp lệ' });
        await coordinatorService.rejectReceiptRequest(requestId, req.user.userId, req.body);
        res.json({ message: 'Đã từ chối yêu cầu phiếu thu' });
    } catch (err) {
        const code = err.message.includes('không tồn tại') ? 404
            : err.message.includes('đã được') ? 409
            : 500;
        res.status(code).json({ error: err.message });
    }
};

const scanReceiptExpenses = async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        if (!requestId) return res.status(400).json({ error: 'Request ID không hợp lệ' });

        const detail = await coordinatorService.getReceiptRequestDetail(requestId);
        if (!detail) return res.status(404).json({ error: 'Không tìm thấy yêu cầu phiếu thu' });

        // Gom tất cả expenses từ các shipment
        const allExpenses = (detail.shipments || []).flatMap((s) => s.expenses || []);

        // Lọc expense có ảnh hóa đơn
        const toScan = allExpenses.filter((e) => Array.isArray(e.receipt_urls) && e.receipt_urls.length > 0);

        // OCR song song
        const results = await Promise.all(
            toScan.map(async (expense) => {
                const imageUrl = expense.receipt_urls[0];
                try {
                    const result = await validateExpenseReceipt(imageUrl, { amount: expense.amount, expenseType: expense.expense_type });
                    return {
                        expense_id:        expense.id,
                        valid:             result.valid,
                        reject_reason:     result.reject_reason,
                    };
                } catch {
                    return { expense_id: expense.id, valid: true, reject_reason: null };
                }
            }),
        );

        // Expense không có ảnh → bỏ qua (không scan)
        const noImageIds = allExpenses
            .filter((e) => !Array.isArray(e.receipt_urls) || e.receipt_urls.length === 0)
            .map((e) => ({ expense_id: e.id, valid: null, reject_reason: null }));

        res.json({ results: [...results, ...noImageIds] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/coordinator/expenses/:id/approve
const approveExpense = async (req, res) => {
    try {
        const expenseId = Number(req.params.id);
        if (!expenseId) return res.status(400).json({ error: 'Expense ID không hợp lệ' });
        const expenseService = require('../services/expenseService');
        const expense = await expenseService.approveExpense(expenseId, req.user.userId);
        res.json({ message: 'Đã duyệt chi phí', expense });
    } catch (err) {
        const code = err.message.includes('Không tìm thấy') ? 404 : 500;
        res.status(code).json({ error: err.message });
    }
};

// PATCH /api/coordinator/expenses/:id/reject  Body: { reason? }
const rejectExpense = async (req, res) => {
    try {
        const expenseId = Number(req.params.id);
        if (!expenseId) return res.status(400).json({ error: 'Expense ID không hợp lệ' });
        const expenseService = require('../services/expenseService');
        const expense = await expenseService.rejectExpense(expenseId, req.user.userId, req.body?.reason);
        res.json({ message: 'Đã từ chối chi phí', expense });
    } catch (err) {
        const code = err.message.includes('Không tìm thấy') ? 404 : 500;
        res.status(code).json({ error: err.message });
    }
};

// PATCH /api/coordinator/trips/:id/cancel  Body: { reason }
// PATCH /api/coordinator/expenses/:id/unapprove — gỡ duyệt để tài xế khai lại
const unapproveExpense = async (req, res) => {
    try {
        const expenseId = Number(req.params.id);
        if (!expenseId) return res.status(400).json({ error: 'Expense ID không hợp lệ' });
        const expenseService = require('../services/expenseService');
        const expense = await expenseService.unapproveExpense(expenseId, req.user.userId);
        res.json({ message: 'Đã gỡ duyệt chi phí — tài xế có thể sửa lại', expense });
    } catch (err) {
        const code = err.message.includes('Không gỡ duyệt được') ? 409 : 500;
        res.status(code).json({ error: err.message });
    }
};

// POST /api/coordinator/orders/:id/assign-driver  Body: { shipment_ids: [], driver_id }
// Gán trước nhiều chuyến của CÙNG đơn cho 1 tài xế (chạy tuần tự)
const assignOrderShipments = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (!orderId) return res.status(400).json({ error: 'Order ID không hợp lệ' });

        const result = await coordinatorService.assignOrderShipments(orderId, {
            shipmentIds: req.body?.shipment_ids,
            driverId: req.body?.driver_id,
        }, req.user.userId);

        const count = result.assignedShipmentIds.length;
        res.json({ message: `Đã gán ${count} chuyến cho tài xế`, ...result });
    } catch (err) {
        const code = err.message.includes('không tồn tại') ? 404
            : err.message.includes('chỉ gán được') || err.message.includes('đã được tài xế khác')
                || err.message.includes('đang chạy chuyến') ? 409
            : err.message.includes('bắt buộc') || err.message.includes('không hợp lệ')
                || err.message.includes('Phải chọn') || err.message.includes('không thuộc') ? 400
            : err.message.includes('chưa nhập km') ? 422
            : 500;
        res.status(code).json({ error: err.message });
    }
};

// POST /api/coordinator/trips/:id/resolve-failed
// Body: { action: 'redeliver'|'return', charge_type?, return_fee? }
const resolveFailedShipment = async (req, res) => {
    try {
        const shipmentId = Number(req.params.id);
        if (!shipmentId) return res.status(400).json({ error: 'Shipment ID không hợp lệ' });

        const shipment = await coordinatorService.resolveFailedShipment(shipmentId, {
            action: req.body?.action,
            chargeType: req.body?.charge_type,
            returnFee: req.body?.return_fee,
        }, req.user.userId);

        const message = req.body?.action === 'redeliver'
            ? 'Đã cho giao lại chuyến'
            : 'Đã chuyển chuyến sang hoàn hàng';
        res.json({ message, shipment });
    } catch (err) {
        const code = err.message.includes('không tồn tại') ? 404
            : err.message.includes('Chỉ xử lý được') ? 409
            : err.message.includes('phải là') || err.message.includes('không hợp lệ')
                || err.message.includes('lớn hơn 0') ? 400
            : 500;
        res.status(code).json({ error: err.message });
    }
};

const cancelShipment = async (req, res) => {
    try {
        const shipmentId = Number(req.params.id);
        if (!shipmentId) return res.status(400).json({ error: 'Shipment ID không hợp lệ' });
        const updated = await coordinatorService.cancelShipment(shipmentId, req.body?.reason, req.user.userId);
        res.json({ message: 'Đã hủy chuyến', shipment: updated });
    } catch (err) {
        const code = err.message.includes('không tồn tại') ? 404
            : err.message.includes('bắt buộc') || err.message.includes('không thể') ? 422
            : 500;
        res.status(code).json({ error: err.message });
    }
};

// PATCH /api/coordinator/trips/:id/reassign  Body: { toDriverId }
const reassignShipment = async (req, res) => {
    try {
        const shipmentId = Number(req.params.id);
        if (!shipmentId) return res.status(400).json({ error: 'Shipment ID không hợp lệ' });
        const updated = await coordinatorService.reassignShipment(shipmentId, { toDriverId: req.body?.toDriverId }, req.user.userId);
        res.json({ message: 'Đã điều chuyển chuyến', shipment: updated });
    } catch (err) {
        const code = err.message.includes('không tồn tại') ? 404
            : err.message.includes('bắt buộc') || err.message.includes('phải khác') || err.message.includes('vui lòng') || err.message.includes('chưa') ? 422
            : 500;
        res.status(code).json({ error: err.message });
    }
};

const getDashboard = async (_req, res) => {
    try {
        const dashboard = await coordinatorService.getDashboard();
        res.json(dashboard);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    listVehicleGroups,
    getDashboard,
    listPartners,
    getIncidents,
    getReceiptRequests,
    getReceiptRequestDetail,
    approveReceiptRequest,
    rejectReceiptRequest,
    scanReceiptExpenses,
    approveExpense,
    rejectExpense,
    unapproveExpense,
    cancelShipment,
    reassignShipment,
    assignOrderShipments,
    resolveFailedShipment,
};
