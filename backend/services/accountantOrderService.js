const accountantOrderRepository = require('../repositories/accountantOrderRepository');
const accountantPaymentRepository = require('../repositories/accountantPaymentRepository');
const accountantLookupRepository = require('../repositories/accountantLookupRepository');
const orderRepository = require('../repositories/orderRepository');
const kpiService = require('./kpiService');
const { notifyRolesSafe } = require('./roleNotificationService');

// Đơn ngoài được tạo với shipment status='completed' ngay từ đầu (không qua luồng
// driver hoàn thành trip bình thường), nên phải tự trigger tính KPI ở đây — nếu không
// kpi_records sẽ không bao giờ được cập nhật cho các chuyến import này.
const triggerKpiRecalc = (result) => {
    (result?.kpiTriggers || []).forEach(({ driverId, completedAt }) => {
        kpiService.recalculateAfterCompletion(driverId, completedAt ? new Date(completedAt) : new Date());
    });
    delete result?.kpiTriggers;
    return result;
};

const getOrders = async (filters, page, limit) => {
    return accountantOrderRepository.getAllOrders(filters, page, limit);
};

const exportOrdersReport = async (filters) => {
    return accountantOrderRepository.exportOrdersReport(filters);
};

const getOrderShipments = async (orderId) => {
    return accountantOrderRepository.getOrderShipments(orderId);
};

const createOrder = async (orderData) => {
    const result = await accountantOrderRepository.createOrderWithShipments(orderData);
    accountantLookupRepository.invalidateLookupCache();
    const finalResult = triggerKpiRecalc(result);
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
    for (const order of orders) {
        const result = await accountantOrderRepository.createOrderWithShipments({
            ...order,
            created_by: createdByUserId,
            suppress_notifications: true,
        });
        results.push(triggerKpiRecalc(result));
    }
    accountantLookupRepository.invalidateLookupCache();
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
    notifyImportSummary,
    getPaymentsByOrderId,
    recordPayment,
    getCustomerDebtSummary,
    confirmDriverPayment,
    getVehicleDriverLookup,
    updateOrder,
    exportOrdersReport,
    searchCustomersByPhone,
    listPartners,
};
