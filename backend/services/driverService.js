const driverRepository = require('../repositories/driverRepository');

const getAllDrivers = async () => driverRepository.getAllDrivers();

module.exports = { getAllDrivers };
