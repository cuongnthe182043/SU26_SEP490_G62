const managerService = require('../services/managerService');
const accountantPayrollRepository = require('../repositories/accountantPayrollRepository');
const notificationService = require('../services/notificationService');

const parseId = (value, label) => {
    const parsed = Number(value);
    if (!parsed) {
        const error = new Error(`${label} không hợp lệ`);
        error.statusCode = 400;
        throw error;
    }
    return parsed;
};

const sendError = (res, err, defaultStatus = 500) => {
    const status = err.statusCode
        || (String(err.message || '').includes('không tồn tại') ? 404 : null)
        || (String(err.message || '').includes('đã được xử lý') ? 409 : null)
        || (String(err.message || '').includes('không hợp lệ') ? 400 : null)
        || defaultStatus;

    res.status(status).json({ error: err.message });
};

const getDashboard = async (_req, res) => {
    try {
        const dashboard = await managerService.getDashboard();
        res.json(dashboard);
    } catch (err) {
        sendError(res, err);
    }
};

const getReportsOverview = async (req, res) => {
    try {
        const months = parseInt(req.query.months, 10) || 6;
        if (Number.isNaN(months) || months < 1 || months > 24) {
            const error = new Error('Số tháng thống kê không hợp lệ (1–24)');
            error.statusCode = 400;
            throw error;
        }
        const granularity = req.query.granularity || 'month';
        if (!['day', 'week', 'month'].includes(granularity)) {
            const error = new Error('Mức thời gian không hợp lệ (day/week/month)');
            error.statusCode = 400;
            throw error;
        }
        const data = await managerService.getReportsOverview({ months, granularity });
        res.json(data);
    } catch (err) {
        sendError(res, err);
    }
};

// Báo cáo kinh doanh theo kỳ (tháng). Mặc định = tháng hiện tại theo giờ VN.
const getBusinessReport = async (req, res) => {
    try {
        const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000); // UTC+7
        const year  = parseInt(req.query.year, 10)  || vnNow.getUTCFullYear();
        const month = parseInt(req.query.month, 10) || (vnNow.getUTCMonth() + 1);

        if (Number.isNaN(year) || year < 2000 || year > 2100) {
            const error = new Error('Năm không hợp lệ'); error.statusCode = 400; throw error;
        }
        if (Number.isNaN(month) || month < 1 || month > 12) {
            const error = new Error('Tháng không hợp lệ (1–12)'); error.statusCode = 400; throw error;
        }

        const data = await managerService.getBusinessReport({ year, month });
        res.json(data);
    } catch (err) {
        sendError(res, err);
    }
};

// Đọc + validate (year, month) từ body cho các thao tác chốt kỳ.
const parsePeriodBody = (body = {}) => {
    const year = parseInt(body.year, 10);
    const month = parseInt(body.month, 10);
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
        const err = new Error('Năm không hợp lệ'); err.statusCode = 400; throw err;
    }
    if (Number.isNaN(month) || month < 1 || month > 12) {
        const err = new Error('Tháng không hợp lệ (1–12)'); err.statusCode = 400; throw err;
    }
    return { year, month };
};

const closeReportPeriod = async (req, res) => {
    try {
        const { year, month } = parsePeriodBody(req.body);
        const data = await managerService.closeReportPeriod({
            year, month, actorId: req.user.userId, note: req.body?.note?.trim() || null,
        });
        res.json({ message: 'Đã chốt kỳ báo cáo', report: data });
    } catch (err) {
        sendError(res, err);
    }
};

const signOffReportPeriod = async (req, res) => {
    try {
        const { year, month } = parsePeriodBody(req.body);
        const data = await managerService.signOffReportPeriod({ year, month, actorId: req.user.userId });
        res.json({ message: 'Đã ký duyệt kỳ báo cáo', report: data });
    } catch (err) {
        sendError(res, err);
    }
};

const reopenReportPeriod = async (req, res) => {
    try {
        const { year, month } = parsePeriodBody(req.body);
        const data = await managerService.reopenReportPeriod({ year, month });
        res.json({ message: 'Đã mở lại kỳ báo cáo', report: data });
    } catch (err) {
        sendError(res, err);
    }
};

const listReportPeriods = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 24, 60);
        const periods = await managerService.listReportPeriods({ limit });
        res.json({ periods });
    } catch (err) {
        sendError(res, err);
    }
};

const getSalaryAdvances = async (req, res) => {
    try {
        const advances = await managerService.listSalaryAdvances(req.query);
        res.json({ advances });
    } catch (err) {
        sendError(res, err);
    }
};

const approveSalaryAdvance = async (req, res) => {
    try {
        const advanceId = parseId(req.params.id, 'Advance ID');
        const advance = await managerService.approveSalaryAdvance(advanceId, req.user.userId);
        res.json({ message: 'Đã phê duyệt yêu cầu ứng lương', advance });
    } catch (err) {
        sendError(res, err);
    }
};

const rejectSalaryAdvance = async (req, res) => {
    try {
        const advanceId = parseId(req.params.id, 'Advance ID');
        const advance = await managerService.rejectSalaryAdvance(advanceId, req.user.userId, req.body?.reason);
        res.json({ message: 'Đã từ chối yêu cầu ứng lương', advance });
    } catch (err) {
        sendError(res, err);
    }
};

const getPendingDebtRepayments = async (_req, res) => {
    try {
        const repayments = await managerService.getPendingDebtRepayments();
        res.json({ repayments });
    } catch (err) {
        sendError(res, err);
    }
};

const confirmDebtRepayment = async (req, res) => {
    try {
        const paymentId = parseId(req.params.paymentId, 'Payment ID');
        const result = await managerService.confirmDebtRepayment(paymentId, req.user.userId);
        res.json({ message: 'Đã xác nhận nộp tiền', ...result });
    } catch (err) {
        sendError(res, err);
    }
};

const rejectDebtRepayment = async (req, res) => {
    try {
        const paymentId = parseId(req.params.paymentId, 'Payment ID');
        await managerService.rejectDebtRepayment(paymentId, req.user.userId, req.body?.reason);
        res.json({ message: 'Đã từ chối yêu cầu nộp tiền' });
    } catch (err) {
        sendError(res, err);
    }
};

const getReceiptRequests = async (req, res) => {
    try {
        const data = await managerService.getReceiptRequests(req.query);
        res.json(data);
    } catch (err) {
        sendError(res, err);
    }
};

const getPartners = async (req, res) => {
    try {
        const data = await managerService.listPartners(req.query);
        res.json(data);
    } catch (err) {
        sendError(res, err);
    }
};

const createPartner = async (req, res) => {
    try {
        const partner = await managerService.createPartner(req.body, req.user.userId);
        res.status(201).json({ message: 'Đã tạo đối tác mới', partner });
    } catch (err) {
        sendError(res, err);
    }
};

const updatePartner = async (req, res) => {
    try {
        const partnerId = parseId(req.params.id, 'Partner ID');
        const partner = await managerService.updatePartner(partnerId, req.body, req.user.userId);
        res.json({ message: 'Đã cập nhật đối tác', partner });
    } catch (err) {
        sendError(res, err);
    }
};

const getPartnerDebtDetails = async (req, res) => {
    try {
        const partnerId = parseId(req.params.id, 'Partner ID');
        const data = await managerService.getPartnerDebtDetails(partnerId);
        res.json(data);
    } catch (err) {
        sendError(res, err);
    }
};

const recordPartnerPayment = async (req, res) => {
    try {
        const partnerId = parseId(req.params.id, 'Partner ID');
        const { amount, payment_method, notes } = req.body || {};
        const result = await managerService.recordPartnerPayment(
            partnerId,
            { amount, paymentMethod: payment_method, notes },
            req.user.userId,
        );
        res.json({ message: 'Đã ghi nhận đối tác thanh toán.', ...result });
    } catch (err) {
        if (!err.status) err.status = err.message?.includes('không tồn tại') ? 404 : 400;
        sendError(res, err);
    }
};

const PAYROLL_STATUSES = ['pending', 'reviewed', 'approved', 'paid'];

const getPayrolls = async (req, res) => {
    try {
        const { status, search, sort } = req.query;
        const now   = new Date();
        const month = Number(req.query.month) || now.getMonth() + 1;
        const year  = Number(req.query.year)  || now.getFullYear();

        if (status && !PAYROLL_STATUSES.includes(status))
            return res.status(400).json({ error: 'Trạng thái bảng lương không hợp lệ' });

        const [rows, stats] = await Promise.all([
            accountantPayrollRepository.getAllPayrolls({ month, year, status: status || null, search: search?.trim() || null, sort: sort || null }),
            accountantPayrollRepository.getPayrollStats({ month, year }),
        ]);
        res.json({ payrolls: rows, stats, month, year });
    } catch (err) {
        sendError(res, err);
    }
};

const reviewPayroll = async (req, res) => {
    try {
        const payrollId = parseId(req.params.id, 'Payroll ID');
        const row = await accountantPayrollRepository.reviewPayroll(payrollId, req.user.userId);

        notificationService.getUserIdsByRole('accountant').then((ids) =>
            notificationService.createForUsers(ids, {
                title: 'Bảng lương cần xác nhận',
                message: `Manager đã duyệt bảng lương tháng ${row.payroll_month}/${row.payroll_year}. Vui lòng xác nhận và chi trả.`,
                type: 'PAYROLL_REVIEWED',
                entityType: 'payroll',
                entityId: row.id,
            }, { displayMode: 'toast' })
        ).catch(() => {});

        res.json({ message: 'Đã xác nhận bảng lương (reviewed).', payroll: row });
    } catch (err) {
        sendError(res, err);
    }
};

const revertPayroll = async (req, res) => {
    try {
        const payrollId = parseId(req.params.id, 'Payroll ID');
        const reason = req.body?.reason?.trim() || null;
        if (reason && reason.length > 500)
            return res.status(400).json({ error: 'Lý do không được vượt quá 500 ký tự.' });

        const row = await accountantPayrollRepository.revertPayrollToPending(payrollId, req.user.userId, reason);

        notificationService.getUserIdsByRole('accountant').then((ids) =>
            notificationService.createForUsers(ids, {
                title: 'Bảng lương bị trả về tính lại',
                message: `Manager đã trả về bảng lương tháng ${row.payroll_month}/${row.payroll_year} để tính lại${reason ? `: ${reason}` : ''}.`,
                type: 'PAYROLL_REVERTED',
                entityType: 'payroll',
                entityId: row.id,
            }, { displayMode: 'toast' })
        ).catch(() => {});

        res.json({ message: 'Đã trả phiếu lương về để tính lại.', payroll: row });
    } catch (err) {
        if (!err.status) err.status = err.message?.includes('không tồn tại') ? 404 : 400;
        sendError(res, err);
    }
};

const getIncidents = async (req, res) => {
    try {
        const { status, severity_level, search, sort, page, limit } = req.query;
        const coordinatorService = require('../services/coordinatorService');
        const result = await coordinatorService.getIncidents({
            status: status || null,
            severityLevel: severity_level || null,
            search: search || '',
            sort: sort || 'newest',
            page,
            limit,
        });
        res.json(result);
    } catch (err) {
        sendError(res, err);
    }
};

const cancelShipment = async (req, res) => {
    try {
        const shipmentId = parseId(req.params.id, 'Shipment ID');
        const coordinatorService = require('../services/coordinatorService');
        const updated = await coordinatorService.cancelShipment(shipmentId, req.body?.reason, req.user.userId);
        res.json({ message: 'Đã hủy chuyến', shipment: updated });
    } catch (err) {
        sendError(res, err);
    }
};

const reassignShipment = async (req, res) => {
    try {
        const shipmentId = parseId(req.params.id, 'Shipment ID');
        const coordinatorService = require('../services/coordinatorService');
        const updated = await coordinatorService.reassignShipment(shipmentId, { toDriverId: req.body?.toDriverId }, req.user.userId);
        res.json({ message: 'Đã điều chuyển chuyến', shipment: updated });
    } catch (err) {
        sendError(res, err);
    }
};

module.exports = {
    getDashboard,
    getReportsOverview,
    getBusinessReport,
    closeReportPeriod,
    signOffReportPeriod,
    reopenReportPeriod,
    listReportPeriods,
    getSalaryAdvances,
    approveSalaryAdvance,
    rejectSalaryAdvance,
    getPendingDebtRepayments,
    confirmDebtRepayment,
    rejectDebtRepayment,
    getReceiptRequests,
    getPartners,
    createPartner,
    updatePartner,
    getPartnerDebtDetails,
    recordPartnerPayment,
    getPayrolls,
    reviewPayroll,
    revertPayroll,
    cancelShipment,
    reassignShipment,
    getIncidents,
};
