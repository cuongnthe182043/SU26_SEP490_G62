const accountantOrderService = require('../../services/accountant/accountantOrderService');

const getOrders = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            search: req.query.search,
        };

        const page = req.query.page ? Number(req.query.page) : null;
        const limit = req.query.limit ? Number(req.query.limit) : null;

        const result = await accountantOrderService.getOrders(filters, page, limit);
        res.json(result);
    } catch (err) {
        console.error('Error fetching accountant orders:', err);
        res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
    }
};

const createOrder = async (req, res) => {
    try {
        const {
            customer_name,
            customer_phone,
            customer_company,
            cargo_name,
            cargo_weight,
            pickup_address,
            delivery_address,
            estimated_price,
            payment_type,
            notes,
        } = req.body;

        if (!customer_name || !customer_phone || !pickup_address || !delivery_address) {
            return res.status(400).json({ error: 'Customer name, phone, pickup and delivery addresses are required' });
        }

        const createdByUserId = req.user.userId;

        const orderData = {
            customer_name,
            customer_phone,
            customer_company,
            cargo_name,
            cargo_weight: Number(cargo_weight),
            pickup_address,
            delivery_address,
            estimated_price: Number(estimated_price),
            payment_type,
            status: 'pending',
            notes,
            created_by: createdByUserId,
        };

        const newOrder = await accountantOrderService.createOrder(orderData);
        res.status(201).json({ message: 'Order created successfully', order: newOrder });
    } catch (err) {
        console.error('Error creating accountant order:', err);
        res.status(500).json({ error: 'Failed to create order', details: err.message });
    }
};

const importOrders = async (req, res) => {
    try {
        const { orders } = req.body;
        if (!orders || !Array.isArray(orders) || orders.length === 0) {
            return res.status(400).json({ error: 'A non-empty array of orders is required for import' });
        }

        const createdByUserId = req.user.userId;
        const importedOrders = await accountantOrderService.importOrders(orders, createdByUserId);

        res.status(201).json({
            message: `Successfully imported ${importedOrders.length} orders`,
            count: importedOrders.length,
            orders: importedOrders,
        });
    } catch (err) {
        console.error('Error importing accountant orders:', err);
        res.status(500).json({ error: 'Failed to import orders', details: err.message });
    }
};

const getPayments = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ error: 'Invalid order id' });
        }

        const payments = await accountantOrderService.getPaymentsByOrderId(orderId);
        res.json(payments);
    } catch (err) {
        console.error('Error fetching payments:', err);
        res.status(500).json({ error: 'Failed to load payment history', details: err.message });
    }
};

const createPayment = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ error: 'Invalid order id' });
        }

        const { amount, paymentMethod, notes } = req.body;
        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Payment amount must be greater than 0' });
        }

        const createdBy = req.user.userId;
        const result = await accountantOrderService.recordPayment(orderId, {
            amount,
            paymentMethod,
            notes,
            createdBy,
        });

        res.status(201).json({
            message: 'Payment recorded successfully',
            payment: result.payment,
            newPaidAmount: result.newPaidAmount,
            newStatus: result.newStatus,
        });
    } catch (err) {
        console.error('Error recording payment:', err);
        res.status(500).json({ error: err.message || 'Internal error while recording payment' });
    }
};

module.exports = {
    getOrders,
    createOrder,
    importOrders,
    getPayments,
    createPayment,
};
