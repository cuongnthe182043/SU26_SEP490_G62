const vehicleManagementService = require('../services/vehicleManagementService');

const handleError = (res, err) => {
    const statusCode = err.statusCode || 500;
    if (statusCode >= 500) {
        console.error('Vehicle management error:', err);
    }
    res.status(statusCode).json({ error: err.message });
};

const listVehicleGroups = async (_req, res) => {
    try {
        const vehicleGroups = await vehicleManagementService.listVehicleGroups();
        res.json({ vehicleGroups });
    } catch (err) {
        handleError(res, err);
    }
};

const getVehicleGroupDetail = async (req, res) => {
    try {
        const vehicleGroup = await vehicleManagementService.getVehicleGroupDetail(req.params.id);
        res.json({ vehicleGroup });
    } catch (err) {
        handleError(res, err);
    }
};

const createVehicleGroup = async (req, res) => {
    try {
        const vehicleGroup = await vehicleManagementService.createVehicleGroup(req.body);
        res.status(201).json({ message: 'Vehicle group created successfully', vehicleGroup });
    } catch (err) {
        handleError(res, err);
    }
};

const updateVehicleGroup = async (req, res) => {
    try {
        const vehicleGroup = await vehicleManagementService.updateVehicleGroup(req.params.id, req.body);
        res.json({ message: 'Vehicle group updated successfully', vehicleGroup });
    } catch (err) {
        handleError(res, err);
    }
};

const deleteVehicleGroup = async (req, res) => {
    try {
        const result = await vehicleManagementService.deleteVehicleGroup(req.params.id);
        res.json({ message: 'Vehicle group deleted successfully', id: result.id });
    } catch (err) {
        handleError(res, err);
    }
};

const listVehicles = async (req, res) => {
    try {
        const result = await vehicleManagementService.listVehicles(req.query);
        res.json(result);
    } catch (err) {
        handleError(res, err);
    }
};

const getVehicleDetail = async (req, res) => {
    try {
        const vehicle = await vehicleManagementService.getVehicleDetail(req.params.id);
        res.json({ vehicle });
    } catch (err) {
        handleError(res, err);
    }
};

const createVehicle = async (req, res) => {
    try {
        const vehicle = await vehicleManagementService.createVehicle(req.body);
        res.status(201).json({ message: 'Vehicle created successfully', vehicle });
    } catch (err) {
        handleError(res, err);
    }
};

const updateVehicle = async (req, res) => {
    try {
        const vehicle = await vehicleManagementService.updateVehicle(req.params.id, req.body);
        res.json({ message: 'Vehicle updated successfully', vehicle });
    } catch (err) {
        handleError(res, err);
    }
};

const changeVehicleStatus = async (req, res) => {
    try {
        const vehicle = await vehicleManagementService.changeVehicleStatus(req.params.id, req.body);
        res.json({ message: 'Vehicle status updated successfully', vehicle });
    } catch (err) {
        handleError(res, err);
    }
};

const setVehicleDriverAssignment = async (req, res) => {
    try {
        const vehicle = await vehicleManagementService.setVehicleDriverAssignment(req.params.id, req.body);
        res.json({ message: 'Vehicle driver assignment updated successfully', vehicle });
    } catch (err) {
        handleError(res, err);
    }
};

const softDeleteVehicle = async (req, res) => {
    try {
        const vehicle = await vehicleManagementService.softDeleteVehicle(req.params.id);
        res.json({ message: 'Vehicle marked as inactive successfully', vehicle });
    } catch (err) {
        handleError(res, err);
    }
};

const listAssignableDrivers = async (req, res) => {
    try {
        const drivers = await vehicleManagementService.listAssignableDrivers(req.query.vehicle_id ?? null);
        res.json({ drivers });
    } catch (err) {
        handleError(res, err);
    }
};

module.exports = {
    listVehicleGroups,
    getVehicleGroupDetail,
    createVehicleGroup,
    updateVehicleGroup,
    deleteVehicleGroup,
    listVehicles,
    getVehicleDetail,
    createVehicle,
    updateVehicle,
    changeVehicleStatus,
    setVehicleDriverAssignment,
    softDeleteVehicle,
    listAssignableDrivers,
};
