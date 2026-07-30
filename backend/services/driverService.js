const driverRepository = require('../repositories/driverRepository');
const vehicleManagementRepository = require('../repositories/vehicleManagementRepository');
const notificationService = require('./notificationService');
const notificationGateway = require('./notificationGateway');
const { notifyRolesSafe } = require('./roleNotificationService');
// Gọi qua object (không destructure) để test thay được readReceiptTotal — helper mock
// của repo swap property trên module object.
const expenseAiValidator = require('./expenseAiValidator');
const { matchesTotal, fmtVND } = expenseAiValidator;

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const parsePositiveAmount = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw createError(`${fieldName} must be greater than 0`, 400);
    }
    return parsed;
};

// Đối chiếu số tiền tài xế khai với tổng tiền đọc được trên các ảnh hóa đơn đã lưu.
//
// Vì sao cần chạy LẠI ở bước hoàn tất dù upload đã quét: lúc upload, chi phí có thể
// chưa được nhập (cost = NULL) nên scanMaintenanceReceipt chỉ kiểm tra "ảnh có phải
// hóa đơn đọc được" mà KHÔNG so khớp số tiền. Tài xế vì thế có thể up ảnh hóa đơn
// 200k trước rồi khai 5 triệu — vượt rào toàn bộ lớp kiểm tra. Chốt lại ở đây là
// điểm duy nhất biết cả ảnh lẫn số tiền cuối cùng.
//
// Chấp nhận khi số khai khớp TỔNG các hóa đơn (nhiều hóa đơn rời) HOẶC khớp hóa đơn
// lớn nhất (tài xế chụp cùng một hóa đơn nhiều góc) — nếu chỉ so tổng thì trường hợp
// thứ hai sẽ bị từ chối oan.
//
// Fail-open khi KHÔNG đọc được ảnh nào (OCR lỗi/ảnh mờ): manager vẫn còn chốt cuối
// ở bước xác nhận, không chặn cứng tài xế vì sự cố hạ tầng.
const assertMaintenanceCostMatchesBills = async (cost, billPics) => {
    const totals = (await Promise.all(billPics.map((url) => expenseAiValidator.readReceiptTotal(url))))
        .filter((total) => Number.isFinite(total) && total > 0);

    if (totals.length === 0) return;

    const sum = totals.reduce((acc, total) => acc + total, 0);
    const max = Math.max(...totals);
    if (matchesTotal(cost, sum) || matchesTotal(cost, max)) return;

    const err = createError(
        `Số tiền khai (${fmtVND(cost)}) không khớp hóa đơn đã tải lên (đọc được ${fmtVND(sum)}). `
        + 'Vui lòng nhập đúng số tiền trên hóa đơn hoặc chụp lại hóa đơn của khoản này.',
        422,
    );
    err.reject_reason = err.message;
    err.invalidBill = true;
    throw err;
};

const buildMaintenanceVerificationMessage = (vehicle) => {
    const vehicleLabel = vehicle?.plate_number ? `xe ${vehicle.plate_number}` : 'xe vừa bảo dưỡng';
    return `Tài xế đã hoàn tất bảo dưỡng ${vehicleLabel}. Vui lòng kiểm tra hóa đơn và xác nhận.`;
};

const getAllDrivers = async () => driverRepository.getAllDrivers();

const getDriverVehicle = async (profileId) => driverRepository.getDriverVehicle(profileId);

const getMyAssignmentHistory = async (driverId) =>
    vehicleManagementRepository.getDriverAssignmentHistory(driverId);

const MAINTENANCE_REQUEST_TYPES = ['scheduled', 'repair', 'inspection', 'emergency'];

const requestMaintenance = async (driverId, payload, billUrls = []) => {
    const maintenanceType = payload?.maintenance_type;
    const reason = payload?.reason?.trim();

    if (!MAINTENANCE_REQUEST_TYPES.includes(maintenanceType)) {
        throw createError('Loại bảo dưỡng không hợp lệ', 400);
    }
    if (!reason) {
        throw createError('Vui lòng nhập lý do yêu cầu bảo dưỡng', 400);
    }

    const vehicle = await driverRepository.getDriverVehicle(driverId);
    if (!vehicle) {
        throw createError('Tài xế chưa được phân công xe', 404);
    }

    let result;
    try {
        result = await vehicleManagementRepository.createMaintenanceRequest({
            vehicleId: vehicle.id,
            driverId,
            maintenanceType,
            reason,
            billPics: billUrls,
        });
    } catch (err) {
        if (err.code === 'OPEN_MAINTENANCE_EXISTS') {
            throw createError('Xe đang có yêu cầu hoặc đợt bảo dưỡng chưa hoàn tất', 409);
        }
        throw err;
    }

    {
        const payload = {
            type: 'manager.vehicles.changed',
            action: 'maintenance_requested',
            vehicleId: vehicle.id,
            maintenanceRecordId: result.maintenanceId,
        };
        notificationGateway.broadcastToRole('manager', payload);
        notificationGateway.broadcastToRole('accountant', payload);
    }

    try {
        const managerIds = await notificationService.getUserIdsByRole('manager');
        if (managerIds.length > 0) {
            await notificationService.createForUsers(managerIds, {
                title: 'Yêu cầu bảo dưỡng xe',
                message: `Tài xế yêu cầu bảo dưỡng xe ${vehicle.plate_number ?? ''}: ${reason}`,
                type: 'MAINTENANCE_REQUESTED',
                entityType: 'vehicle',
                entityId: vehicle.id,
                displayMode: 'alert',
            });
        }
    } catch (err) {
        console.error('[driverService] Không gửi được notification yêu cầu bảo dưỡng:', err.message);
    }

    notifyRolesSafe(['accountant'], {
        title: 'Yêu cầu bảo dưỡng xe',
        message: `Tài xế yêu cầu bảo dưỡng xe ${vehicle.plate_number ?? ''}: ${reason}`,
        type: 'MAINTENANCE_REQUESTED',
        entityType: 'vehicle',
        entityId: vehicle.id,
    }, { displayMode: 'alert', excludeUserId: driverId });

    return { maintenanceRecordId: result.maintenanceId };
};

const listMaintenanceForDriver = async (driverId) => {
    const records = await vehicleManagementRepository.getMaintenanceRecordsForDriver(driverId);
    return records;
};

const uploadMaintenanceBill = async (driverId, vehicleId, billUrl) => {
    const parsedVehicleId = Number(vehicleId);
    if (!Number.isInteger(parsedVehicleId) || parsedVehicleId <= 0) {
        throw createError('vehicle_id must be a positive integer', 400);
    }
    if (!billUrl) {
        throw createError('Bill image is required', 400);
    }

    // Cho phép thêm bill cả khi yêu cầu bảo dưỡng còn chờ duyệt (requested)
    const record = await vehicleManagementRepository.getActiveMaintenanceRecordForDriver(
        parsedVehicleId, driverId, undefined, ['requested', 'open'],
    );
    if (!record) {
        throw createError('Open maintenance record for this driver and vehicle was not found', 404);
    }

    // Quét tự động NGAY khi upload — chỉ với ảnh hóa đơn ở bước bảo dưỡng (open),
    // không quét ảnh chứng từ/báo giá lúc còn chờ duyệt (requested). Ảnh không hợp lệ
    // bị từ chối ngay (422) và KHÔNG được lưu → tài xế phải upload ảnh khác.
    if (record.status === 'open') {
        const scan = await expenseAiValidator.scanMaintenanceReceipt(billUrl, { amount: record.cost });
        if (!scan.valid) {
            const err = createError(scan.reject_reason || 'Ảnh hóa đơn không hợp lệ', 422);
            err.reject_reason = scan.reject_reason;
            err.invalidBill = true;
            throw err;
        }
    }

    const currentBillPics = Array.isArray(record.bill_pics) ? record.bill_pics : [];
    const nextBillPics = [...currentBillPics, billUrl];
    await vehicleManagementRepository.updateMaintenanceBillPics(record.id, nextBillPics);

    {
        const payload = {
            type: 'manager.vehicles.changed',
            action: 'maintenance_bill_uploaded',
            vehicleId: parsedVehicleId,
            maintenanceRecordId: record.id,
        };
        notificationGateway.broadcastToRole('manager', payload);
        notificationGateway.broadcastToRole('accountant', payload);
    }

    notifyRolesSafe(['manager', 'accountant'], {
        title: 'Tài xế đã tải hóa đơn bảo dưỡng',
        message: `Tài xế đã tải hóa đơn bảo dưỡng cho xe #${parsedVehicleId}.`,
        type: 'MAINTENANCE_BILL_UPLOADED',
        entityType: 'maintenance_record',
        entityId: record.id,
    }, { displayMode: 'toast', excludeUserId: driverId });

    return { maintenanceRecordId: record.id, bill_pics: nextBillPics };
};

const updateMaintenanceCost = async (driverId, vehicleId, cost) => {
    const parsedVehicleId = Number(vehicleId);
    if (!Number.isInteger(parsedVehicleId) || parsedVehicleId <= 0) {
        throw createError('vehicle_id must be a positive integer', 400);
    }
    const parsedCost = Number(cost);
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
        throw createError('cost must be a non-negative number', 400);
    }

    const record = await vehicleManagementRepository.getActiveMaintenanceRecordForDriver(parsedVehicleId, driverId);
    if (!record) {
        throw createError('Open maintenance record for this driver and vehicle was not found', 404);
    }

    await vehicleManagementRepository.updateMaintenanceCost(record.id, parsedCost);
    return { maintenanceRecordId: record.id, cost: parsedCost };
};

const completeMaintenance = async (driverId, vehicleId, payload) => {
    const parsedVehicleId = Number(vehicleId);
    if (!Number.isInteger(parsedVehicleId) || parsedVehicleId <= 0) {
        throw createError('vehicle_id must be a positive integer', 400);
    }

    const cost = parsePositiveAmount(payload?.cost, 'cost');

    const record = await vehicleManagementRepository.getActiveMaintenanceRecordForDriver(parsedVehicleId, driverId);
    if (!record) {
        throw createError('Open maintenance record for this driver and vehicle was not found', 404);
    }

    const billPics = Array.isArray(record.bill_pics) ? record.bill_pics : [];
    if (billPics.length === 0) {
        throw createError('At least one maintenance bill image is required before completion', 400);
    }

    await assertMaintenanceCostMatchesBills(cost, billPics);

    await vehicleManagementRepository.completeMaintenanceRecordAndSetStatus({
        vehicleId: parsedVehicleId,
        maintenanceRecordId: record.id,
        driverId,
        billPics,
        performedBy: driverId,
        cost,
    });

    const vehicle = await vehicleManagementRepository.getVehicleById(parsedVehicleId);
    const notificationMessage = buildMaintenanceVerificationMessage(vehicle);

    {
        const payload = {
            type: 'manager.vehicles.changed',
            action: 'maintenance_completed',
            vehicleId: parsedVehicleId,
            maintenanceRecordId: record.id,
            status: vehicle?.status ?? 'maintenance',
        };
        notificationGateway.broadcastToRole('manager', payload);
        notificationGateway.broadcastToRole('accountant', payload);
    }

    notificationGateway.broadcastToRole('manager', {
        type: 'maintenance.completed',
        vehicleId: parsedVehicleId,
        maintenanceRecordId: record.id,
        message: notificationMessage,
    });

    try {
        const managerIds = await notificationService.getUserIdsByRole('manager');
        if (managerIds.length > 0) {
            await notificationService.createForUsers(managerIds, {
                title: 'Tài xế đã hoàn tất bảo dưỡng',
                message: notificationMessage,
                type: 'MAINTENANCE_COMPLETED',
                entityType: 'vehicle',
                entityId: parsedVehicleId,
                displayMode: 'alert',
            });
        }
    } catch {
        // Notification failure must not abort the main flow.
    }

    notifyRolesSafe(['accountant'], {
        title: 'Tài xế đã hoàn tất bảo dưỡng',
        message: notificationMessage,
        type: 'MAINTENANCE_COMPLETED',
        entityType: 'vehicle',
        entityId: parsedVehicleId,
    }, { displayMode: 'alert', excludeUserId: driverId });

    return { maintenanceRecordId: record.id };
};

module.exports = {
    getAllDrivers,
    getDriverVehicle,
    getMyAssignmentHistory,
    requestMaintenance,
    listMaintenanceForDriver,
    uploadMaintenanceBill,
    updateMaintenanceCost,
    completeMaintenance,
};
