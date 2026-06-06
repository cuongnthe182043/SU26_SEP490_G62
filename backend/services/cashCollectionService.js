const repo = require('../repositories/cashCollectionRepository');

const VALID_METHODS = ['cash', 'bank_transfer'];

const getMyCollections = async (driverId, filters = {}) => {
    return repo.getDriverCollections(driverId, filters);
};

const getMyCollection = async (driverId, id) => {
    const col = await repo.getCollectionById(id, driverId);
    if (!col) throw new Error('Không tìm thấy bản ghi thu hộ');
    return col;
};

const createCollection = async (driverId, { shipmentId, amount, paymentMethod = 'cash', notes, receiptUrl }) => {
    if (!amount || Number(amount) <= 0) throw new Error('Số tiền phải lớn hơn 0');
    if (!VALID_METHODS.includes(paymentMethod)) throw new Error('Hình thức thanh toán không hợp lệ');
    return repo.createCollection(driverId, {
        shipmentId: shipmentId ? Number(shipmentId) : null,
        amount: Number(amount),
        paymentMethod,
        notes,
        receiptUrl,
    });
};

const getSummary = async (driverId) => {
    return repo.getCollectionSummary(driverId);
};

module.exports = { getMyCollections, getMyCollection, createCollection, getSummary };
