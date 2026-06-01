const driverService = require('../services/driverService');

const getAllDrivers = async (_req, res) => {
    try {
        const drivers = await driverService.getAllDrivers();
        res.json({ drivers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAllDrivers };
