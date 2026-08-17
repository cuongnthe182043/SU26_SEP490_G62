const accountantOrderRepository = require('../repositories/accountantOrderRepository');
const accountantPaymentRepository = require('../repositories/accountantPaymentRepository');
const accountantLookupRepository = require('../repositories/accountantLookupRepository');
const orderRepository = require('../repositories/orderRepository');
const kpiService = require('./kpiService');
const { notifyRolesSafe } = require('./roleNotificationService');

// Đơn ngoài được tạo với shipment status='completed' ngay từ đầu (không qua luồng
// driver hoàn thành trip bình thường), nên phải tự trigger tính KPI ở đây — nếu không
// kpi_records sẽ không bao giờ được cập nhật cho các chuyến import này.
//
// PHẢI await. Trước đây gọi rồi bỏ đó: import 1000 dòng sinh ra 1000 promise recalc
// rời rạc, response trả về ngay sau vòng lặp, và Cloud Run bóp CPU về gần 0 ngay lúc
// đó — phần lớn recalc không bao giờ chạy xong. Đó là lý do doanh thu đơn ngoài đã
// import vào rồi mà bảng lương vẫn không thấy cộng, và cộng thiếu một cách ngẫu nhiên.
const triggerKpiRecalc = async (result, { collectInto = null } = {}) => {
    const triggers = result?.kpiTriggers || [];
    delete result?.kpiTriggers;

    // Import hàng loạt: gom lại, để cuối lượt gộp rồi tính MỘT lần cho mỗi tài/tháng.
    if (collectInto) {
        collectInto.push(...triggers);
        return result;
    }

    await flushKpiRecalc(triggers);
    return result;
};

/**
 * Tính lại KPI cho một mẻ trigger, ĐÃ GỘP theo (tài xế, tháng, năm).
 *
 * recalculateDriverKPI không cộng dồn — nó quét lại toàn bộ chuyến hoàn thành của tài
 * trong cả tháng rồi ghi đè. Nên với một tài xế trong một tháng, gọi 1 lần hay 500 lần
 * đều cho ra đúng con số ấy; 499 lần còn lại là quét lại y hệt, vô ích.
 *
 * Vì sao đây là lỗi chứ không chỉ là chậm: import 500 dòng cùng một tài trong cùng
 * tháng trước đây chạy 500 lượt quét toàn tháng NỐI TIẾP nhau, mỗi lượt lại nặng thêm
 * vì bảng vừa phình ra. Pool đặt statement_timeout = 15s, Cloud Run cắt request ở 300s
 * — mẻ import lớn đụng trần trước khi chạy xong, phần còn lại không bao giờ được tính.
 * Đó là lý do "import ít thì được, import nhiều thì tài xế không thấy doanh thu đâu".
 * Gộp lại thì 500 lượt còn đúng 1.
 */
const flushKpiRecalc = async (triggers = []) => {
    const theoTaiVaThang = new Map();
    for (const { driverId, completedAt } of triggers) {
        if (!driverId) continue;
        const moc = completedAt ? new Date(completedAt) : new Date();
        const khoa = `${driverId}|${moc.getFullYear()}|${moc.getMonth()}`;
        if (!theoTaiVaThang.has(khoa)) theoTaiVaThang.set(khoa, { driverId, moc });
    }
    if (theoTaiVaThang.size === 0) return;

    await Promise.all([...theoTaiVaThang.values()].map(({ driverId, moc }) =>
        kpiService.recalculateAfterCompletion(driverId, moc),
    ));
};

const getOrders = async (filters, page, limit) => {
    return accountantOrderRepository.getAllOrders(filters, page, limit);
};

const previewImport = async (items) => {
    return accountantOrderRepository.previewImport(items);
};

const exportOrdersReport = async (filters) => {
    return accountantOrderRepository.exportOrdersReport(filters);
};

const getOrderShipments = async (orderId) => {
    return accountantOrderRepository.getOrderShipments(orderId);
};

// collectKpiInto: mảng do bên gọi truyền vào để hoãn việc tính KPI (dùng khi import
// hàng loạt — xem flushKpiRecalc). Không truyền thì tính ngay như thường.
const createOrder = async (orderData, { collectKpiInto = null } = {}) => {
    const result = await accountantOrderRepository.createOrderWithShipments(orderData);
    accountantLookupRepository.invalidateLookupCache();
    const finalResult = await triggerKpiRecalc(result, { collectInto: collectKpiInto });
    if (!orderData.suppress_notifications) {
        notifyRolesSafe(['coordinator', 'manager'], {
            title: 'Có đơn hàng doanh thu mới',
            message: `Kế toán vừa tạo đơn hàng #${finalResult?.id ?? ''}.`,
            type: 'ORDER_CREATED',
            entityType: 'orders',
            entityId: finalResult?.id ?? null,
        }, { excludeUserId: orderData.created_by, displayMode: 'toast' });
    }
    return finalResult;
};

const notifyImportSummary = ({ count, actorId }) => {
    if (!count) return;
    notifyRolesSafe(['coordinator', 'manager'], {
        title: 'Đã import đơn hàng doanh thu',
        message: `Kế toán vừa import thành công ${count} đơn hàng.`,
        type: 'ORDER_IMPORTED',
        entityType: 'orders',
        entityId: null,
    }, { excludeUserId: actorId, displayMode: 'toast' });
};

const importOrders = async (orders, createdByUserId) => {
    const results = [];
    const kpiTriggers = [];
    for (const order of orders) {
        const result = await accountantOrderRepository.createOrderWithShipments({
            ...order,
            created_by: createdByUserId,
            suppress_notifications: true,
        });
        results.push(await triggerKpiRecalc(result, { collectInto: kpiTriggers }));
    }
    accountantLookupRepository.invalidateLookupCache();
    // Tính KPI MỘT lần cho mỗi tài/tháng sau khi đã nạp hết — xem flushKpiRecalc.
    await flushKpiRecalc(kpiTriggers);
    notifyImportSummary({ count: results.length, actorId: createdByUserId });
    return results;
};

const getPaymentsByOrderId = async (orderId) => {
    return accountantPaymentRepository.getPaymentsByOrderId(orderId);
};

const recordPayment = async (orderId, paymentData) => {
    const result = await accountantPaymentRepository.recordPaymentWithOverflow(orderId, paymentData);
    notifyRolesSafe(['manager', 'coordinator'], {
        title: 'Đã ghi nhận thanh toán',
        message: `Kế toán đã ghi nhận thanh toán cho đơn hàng #${orderId}.`,
        type: 'ORDER_PAYMENT_RECORDED',
        entityType: 'receipt',
        entityId: orderId,
    }, { excludeUserId: paymentData.createdBy, displayMode: 'toast' });
    return result;
};

const getCustomerDebtSummary = async (orderId) => {
    return accountantPaymentRepository.getCustomerDebtSummary(orderId);
};

const confirmDriverPayment = async (shipmentId, driverPaymentState, amount, paymentMethod, confirmedBy) => {
    const result = await accountantPaymentRepository.confirmDriverPayment(shipmentId, driverPaymentState, amount, paymentMethod, confirmedBy);
    notifyRolesSafe(['manager', 'coordinator'], {
        title: 'Đã xác nhận tiền tài xế thu',
        message: `Kế toán đã xác nhận khoản thu của tài xế cho chuyến #${shipmentId}.`,
        type: 'DRIVER_PAYMENT_CONFIRMED',
        entityType: 'receipt',
        entityId: shipmentId,
    }, { excludeUserId: confirmedBy, displayMode: 'toast' });
    return result;
};

const updateOrder = async (orderId, orderData) => {
    const updated = await accountantOrderRepository.updateOrder(orderId, orderData);
    notifyRolesSafe(['coordinator', 'manager'], {
        title: 'Đơn hàng doanh thu đã cập nhật',
        message: `Kế toán vừa cập nhật đơn hàng #${orderId}.`,
        type: 'ORDER_UPDATED',
        entityType: 'orders',
        entityId: orderId,
    }, { excludeUserId: orderData.updated_by, displayMode: 'toast' });
    return updated;
};

const getVehicleDriverLookup = async () => {
    return accountantLookupRepository.getVehicleDriverLookup();
};

const searchCustomersByPhone = async (phonePrefix) => {
    return accountantOrderRepository.searchCustomersByPhone(phonePrefix);
};

const listPartners = async () => {
    return orderRepository.listCoordinatorPartners();
};

module.exports = {
    getOrders,
    getOrderShipments,
    createOrder,
    importOrders,
    flushKpiRecalc,
    notifyImportSummary,
    getPaymentsByOrderId,
    recordPayment,
    getCustomerDebtSummary,
    confirmDriverPayment,
    getVehicleDriverLookup,
    updateOrder,
    exportOrdersReport,
    previewImport,
    searchCustomersByPhone,
    listPartners,
};
