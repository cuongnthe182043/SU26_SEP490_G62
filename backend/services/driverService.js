const driverRepository = require('../repositories/driverRepository');
const vehicleManagementRepository = require('../repositories/vehicleManagementRepository');

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const getAllDrivers = async () => driverRepository.getAllDrivers();

const uploadMaintenanceBill = async (driverId, vehicleId, billUrl) => {
    const parsedVehicleId = Number(vehicleId);
    if (!Number.isInteger(parsedVehicleId) || parsedVehicleId <= 0) {
        throw createError('vehicle_id must be a positive integer', 400);
    }
    if (!billUrl) {
        throw createError('Bill image is required', 400);
    }

    const record = await vehicleManagementRepository.getActiveMaintenanceRecordForDriver(parsedVehicleId, driverId);
    if (!record) {
        throw createError('Open maintenance record for this driver and vehicle was not found', 404);
    }

    const currentBillPics = Array.isArray(record.bill_pics) ? record.bill_pics : [];
    const nextBillPics = [...currentBillPics, billUrl];
    await vehicleManagementRepository.updateMaintenanceBillPics(record.id, nextBillPics);

    return { maintenanceRecordId: record.id, bill_pics: nextBillPics };
};

const completeMaintenance = async (driverId, vehicleId) => {
    const parsedVehicleId = Number(vehicleId);
    if (!Number.isInteger(parsedVehicleId) || parsedVehicleId <= 0) {
        throw createError('vehicle_id must be a positive integer', 400);
    }

    const record = await vehicleManagementRepository.getActiveMaintenanceRecordForDriver(parsedVehicleId, driverId);
    if (!record) {
        throw createError('Open maintenance record for this driver and vehicle was not found', 404);
    }

    const billPics = Array.isArray(record.bill_pics) ? record.bill_pics : [];
    if (billPics.length === 0) {
        throw createError('At least one maintenance bill image is required before completion', 400);
    }

    await vehicleManagementRepository.completeMaintenanceRecordAndSetStatus({
        vehicleId: parsedVehicleId,
        maintenanceRecordId: record.id,
        driverId,
        billPics,
        performedBy: driverId,
    });

    return { maintenanceRecordId: record.id };
};

module.exports = { getAllDrivers, uploadMaintenanceBill, completeMaintenance };
