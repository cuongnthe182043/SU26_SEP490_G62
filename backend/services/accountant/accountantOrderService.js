const accountantOrderRepository = require('../../repositories/accountant/accountantOrderRepository');
const accountantPaymentRepository = require('../../repositories/accountant/accountantPaymentRepository');

const getOrders = async (filters, page, limit) => {
    return accountantOrderRepository.getAllOrders(filters, page, limit);
};

const createOrder = async (orderData) => {
    return accountantOrderRepository.createOrder(orderData);
};

const importOrders = async (orders, createdByUserId) => {
    return accountantOrderRepository.bulkCreateOrders(orders, createdByUserId);
};

const getPaymentsByOrderId = async (orderId) => {
    return accountantPaymentRepository.getPaymentsByOrderId(orderId);
};

const recordPayment = async (orderId, paymentData) => {
    return accountantPaymentRepository.recordPayment(orderId, paymentData);
};

module.exports = {
    getOrders,
    createOrder,
    importOrders,
    getPaymentsByOrderId,
    recordPayment,
};
