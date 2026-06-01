const orderRepository = require('../repositories/orderRepository');

/**
 * GET /orders
 * Fetch all orders, supporting optional query filters
 */
const getOrders = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            search: req.query.search,
        };

        const page = req.query.page ? Number(req.query.page) : null;
        const limit = req.query.limit ? Number(req.query.limit) : null;

        const result = await orderRepository.getAllOrders(filters, page, limit);
        res.json(result);
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
    }
};

/**
 * POST /orders
 * Create a single manual order
 */
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

        const createdByUserId = req.user.userId; // Resolved from JWT verifyToken middleware

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

        const newOrder = await orderRepository.createOrder(orderData);
        res.status(201).json({ message: 'Order created successfully', order: newOrder });
    } catch (err) {
        console.error('Error creating order:', err);
        res.status(500).json({ error: 'Failed to create order', details: err.message });
    }
};

/**
 * POST /orders/import
 * Bulk import orders parsed from Excel file
 */
const importOrders = async (req, res) => {
    try {
        const { orders } = req.body;
        if (!orders || !Array.isArray(orders) || orders.length === 0) {
            return res.status(400).json({ error: 'A non-empty array of orders is required for import' });
        }

        const createdByUserId = req.user.userId;

        const importedOrders = await orderRepository.bulkCreateOrders(orders, createdByUserId);
        res.status(201).json({
            message: `Successfully imported ${importedOrders.length} orders`,
            count: importedOrders.length,
            orders: importedOrders
        });
    } catch (err) {
        console.error('Error importing orders:', err);
        res.status(500).json({ error: 'Failed to import orders', details: err.message });
    }
};

module.exports = {
    getOrders,
    createOrder,
    importOrders,
};
