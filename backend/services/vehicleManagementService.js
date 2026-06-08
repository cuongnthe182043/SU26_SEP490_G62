const vehicleManagementRepository = require('../repositories/vehicleManagementRepository');

const VEHICLE_STATUSES = ['available', 'in_delivery', 'maintenance', 'inactive'];

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const parsePositiveInteger = (value, fieldName, { required = true } = {}) => {
    if (value === undefined || value === null || value === '') {
        if (required) throw createError(`${fieldName} is required`, 400);
        return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw createError(`${fieldName} must be a positive integer`, 400);
    }

    return parsed;
};

const parseNullableNumber = (value, fieldName, { min = null } = {}) => {
    if (value === undefined || value === null || value === '') return null;

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw createError(`${fieldName} must be a valid number`, 400);
    }

    if (min !== null && parsed < min) {
        throw createError(`${fieldName} must be greater than or equal to ${min}`, 400);
    }

    return parsed;
};

const parseNullableDate = (value, fieldName) => {
    if (value === undefined || value === null || value === '') return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw createError(`${fieldName} must be a valid date`, 400);
    }

    return value;
};

const normalizeVehicleGroupPayload = (payload = {}) => {
    const name = String(payload.name || '').trim();
    if (!name) throw createError('Vehicle group name is required', 400);

    const pricePerKm = parseNullableNumber(payload.price_per_km, 'price_per_km', { min: 0 });
    if (pricePerKm === null) throw createError('price_per_km is required', 400);

    const depreciationPerKm = payload.depreciation_per_km === undefined
        ? 0
        : parseNullableNumber(payload.depreciation_per_km, 'depreciation_per_km', { min: 0 });

    return {
        name,
        description: payload.description?.trim?.() || null,
        max_load_weight_kg: parseNullableNumber(payload.max_load_weight_kg, 'max_load_weight_kg', { min: 0 }),
        price_per_km: pricePerKm,
        depreciation_per_km: depreciationPerKm,
        upgrade_allowed: Boolean(payload.upgrade_allowed),
    };
};

const validateVehicleGroupNameUniqueness = async (name, excludeId = null) => {
    const existing = await vehicleManagementRepository.getVehicleGroupByName(name, excludeId);
    if (existing) throw createError('Vehicle group name already exists', 409);
};

const listVehicleGroups = async () => vehicleManagementRepository.listVehicleGroups();

const getVehicleGroupDetail = async (vehicleGroupId) => {
    const id = parsePositiveInteger(vehicleGroupId, 'vehicle_group_id');
    const vehicleGroup = await vehicleManagementRepository.getVehicleGroupById(id);
    if (!vehicleGroup) throw createError('Vehicle group not found', 404);
    return vehicleGroup;
};

const createVehicleGroup = async (payload) => {
    const normalizedPayload = normalizeVehicleGroupPayload(payload);
    await validateVehicleGroupNameUniqueness(normalizedPayload.name);

    const vehicleGroupId = await vehicleManagementRepository.createVehicleGroup(normalizedPayload);
    return getVehicleGroupDetail(vehicleGroupId);
};

const updateVehicleGroup = async (vehicleGroupId, payload) => {
    const id = parsePositiveInteger(vehicleGroupId, 'vehicle_group_id');
    const existingVehicleGroup = await vehicleManagementRepository.getVehicleGroupById(id);
    if (!existingVehicleGroup) throw createError('Vehicle group not found', 404);

    const normalizedPayload = normalizeVehicleGroupPayload(payload);
    await validateVehicleGroupNameUniqueness(normalizedPayload.name, id);

    await vehicleManagementRepository.updateVehicleGroup(id, normalizedPayload);
    return getVehicleGroupDetail(id);
};

const deleteVehicleGroup = async (vehicleGroupId) => {
    const id = parsePositiveInteger(vehicleGroupId, 'vehicle_group_id');
    const existingVehicleGroup = await vehicleManagementRepository.getVehicleGroupById(id);
    if (!existingVehicleGroup) throw createError('Vehicle group not found', 404);

    const vehicleCount = await vehicleManagementRepository.countVehiclesByGroupId(id);
    if (vehicleCount > 0) {
        throw createError('Vehicle group cannot be deleted because it is assigned to vehicles', 409);
    }

    try {
        await vehicleManagementRepository.deleteVehicleGroup(id);
    } catch (err) {
        if (err.code === '23503') {
            throw createError('Vehicle group cannot be deleted because it is referenced by other records', 409);
        }
        throw err;
    }

    return { id };
};

const normalizeVehiclePayload = async (payload = {}, { vehicleId = null } = {}) => {
    const plateNumber = String(payload.plate_number || '').trim();
    if (!plateNumber) throw createError('plate_number is required', 400);

    const vehicleGroupId = parsePositiveInteger(payload.vehicle_group_id, 'vehicle_group_id');
    const vehicleGroup = await vehicleManagementRepository.getVehicleGroupReferenceById(vehicleGroupId);
    if (!vehicleGroup) throw createError('Vehicle group does not exist', 400);

    const duplicatePlate = await vehicleManagementRepository.getVehicleByPlateNumber(plateNumber, vehicleId);
    if (duplicatePlate) throw createError('Plate number already exists', 409);

    const manufactureYear = payload.manufacture_year === undefined || payload.manufacture_year === null || payload.manufacture_year === ''
        ? null
        : Number(payload.manufacture_year);

    if (manufactureYear !== null) {
        if (!Number.isInteger(manufactureYear)) {
            throw createError('manufacture_year must be an integer', 400);
        }
        if (manufactureYear > new Date().getFullYear()) {
            throw createError('Manufacture year cannot be in the future', 400);
        }
    }

    const loadCapacity = parseNullableNumber(payload.load_capacity_kg, 'load_capacity_kg');
    if (loadCapacity !== null && loadCapacity <= 0) {
        throw createError('Load capacity must be positive', 400);
    }

    const requestedStatus = payload.status || 'available';
    if (!VEHICLE_STATUSES.includes(requestedStatus)) {
        throw createError(`status must be one of: ${VEHICLE_STATUSES.join(', ')}`, 400);
    }

    const assignedDriverId = parsePositiveInteger(payload.assigned_driver_id, 'assigned_driver_id', { required: false });

    if (assignedDriverId !== null) {
        const driver = await vehicleManagementRepository.getDriverById(assignedDriverId);
        if (!driver) throw createError('Assigned driver does not exist', 400);

        if (driver.vehicle_id && Number(driver.vehicle_id) !== Number(vehicleId)) {
            throw createError('Assigned driver is already assigned to another vehicle', 409);
        }
    }

    return {
        plate_number: plateNumber,
        vehicle_group_id: vehicleGroupId,
        brand: payload.brand?.trim?.() || null,
        model: payload.model?.trim?.() || null,
        load_capacity_kg: loadCapacity,
        manufacture_year: manufactureYear,
        purchase_date: parseNullableDate(payload.purchase_date, 'purchase_date'),
        assigned_driver_id: requestedStatus === 'inactive' ? null : assignedDriverId,
        status: requestedStatus,
    };
};

const listVehicles = async (query = {}) => {
    const page = parsePositiveInteger(query.page ?? 1, 'page');
    const limit = parsePositiveInteger(query.limit ?? 10, 'limit');
    const vehicleGroupId = parsePositiveInteger(query.vehicle_group_id, 'vehicle_group_id', { required: false });
    const status = query.status ? String(query.status).trim() : null;

    if (status && !VEHICLE_STATUSES.includes(status)) {
        throw createError(`status must be one of: ${VEHICLE_STATUSES.join(', ')}`, 400);
    }

    const { rows, total } = await vehicleManagementRepository.listVehicles({
        page,
        limit,
        search: query.search?.trim?.() || null,
        status,
        vehicleGroupId,
    });

    return {
        items: rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
        filters: {
            search: query.search?.trim?.() || '',
            status: status || null,
            vehicle_group_id: vehicleGroupId,
        },
    };
};

const getVehicleDetail = async (vehicleId) => {
    const id = parsePositiveInteger(vehicleId, 'vehicle_id');
    const vehicle = await vehicleManagementRepository.getVehicleById(id);
    if (!vehicle) throw createError('Vehicle not found', 404);
    return vehicle;
};

const validateAssignableDriver = async (assignedDriverId, vehicleId = null) => {
    const parsedDriverId = parsePositiveInteger(assignedDriverId, 'assigned_driver_id', { required: false });
    if (parsedDriverId === null) return null;

    const driver = await vehicleManagementRepository.getDriverById(parsedDriverId);
    if (!driver) throw createError('Assigned driver does not exist', 400);
    if (driver.vehicle_id && Number(driver.vehicle_id) !== Number(vehicleId)) {
        throw createError('Assigned driver is already assigned to another vehicle', 409);
    }

    return parsedDriverId;
};

const createVehicle = async (payload) => {
    const normalizedPayload = await normalizeVehiclePayload({
        ...payload,
        status: payload.status || 'available',
    });

    const vehicleId = await vehicleManagementRepository.createVehicle(normalizedPayload);
    return getVehicleDetail(vehicleId);
};

const updateVehicle = async (vehicleId, payload) => {
    const id = parsePositiveInteger(vehicleId, 'vehicle_id');
    const existingVehicle = await vehicleManagementRepository.getVehicleById(id);
    if (!existingVehicle) throw createError('Vehicle not found', 404);

    const normalizedPayload = await normalizeVehiclePayload({
        ...payload,
        status: payload.status || existingVehicle.status,
    }, { vehicleId: id });

    await vehicleManagementRepository.updateVehicle(id, normalizedPayload);
    return getVehicleDetail(id);
};

const changeVehicleStatus = async (vehicleId, payload = {}) => {
    const id = parsePositiveInteger(vehicleId, 'vehicle_id');
    const existingVehicle = await vehicleManagementRepository.getVehicleById(id);
    if (!existingVehicle) throw createError('Vehicle not found', 404);

    const nextStatus = String(payload.status || '').trim();
    if (!VEHICLE_STATUSES.includes(nextStatus)) {
        throw createError(`status must be one of: ${VEHICLE_STATUSES.join(', ')}`, 400);
    }

    return updateVehicle(id, {
        plate_number: existingVehicle.plate_number,
        vehicle_group_id: existingVehicle.vehicle_group_id,
        brand: existingVehicle.brand,
        model: existingVehicle.model,
        load_capacity_kg: existingVehicle.load_capacity_kg,
        manufacture_year: existingVehicle.manufacture_year,
        purchase_date: existingVehicle.purchase_date,
        assigned_driver_id: nextStatus === 'inactive' ? null : existingVehicle.assigned_driver_id,
        status: nextStatus,
    });
};

const setVehicleDriverAssignment = async (vehicleId, payload = {}) => {
    const id = parsePositiveInteger(vehicleId, 'vehicle_id');
    const existingVehicle = await vehicleManagementRepository.getVehicleById(id);
    if (!existingVehicle) throw createError('Vehicle not found', 404);
    if (existingVehicle.status === 'inactive') {
        throw createError('Cannot assign a driver to an inactive vehicle', 409);
    }

    const assignedDriverId = await validateAssignableDriver(payload.assigned_driver_id, id);

    return updateVehicle(id, {
        plate_number: existingVehicle.plate_number,
        vehicle_group_id: existingVehicle.vehicle_group_id,
        brand: existingVehicle.brand,
        model: existingVehicle.model,
        load_capacity_kg: existingVehicle.load_capacity_kg,
        manufacture_year: existingVehicle.manufacture_year,
        purchase_date: existingVehicle.purchase_date,
        assigned_driver_id: assignedDriverId,
        status: existingVehicle.status,
    });
};

const softDeleteVehicle = async (vehicleId) => changeVehicleStatus(vehicleId, { status: 'inactive' });

const listAssignableDrivers = async (vehicleId = null) => {
    const currentVehicleId = vehicleId === null
        ? null
        : parsePositiveInteger(vehicleId, 'vehicle_id', { required: false });

    const drivers = await vehicleManagementRepository.listDriverOptions();
    return drivers.map((driver) => ({
        ...driver,
        is_assignable: !driver.current_vehicle_id || Number(driver.current_vehicle_id) === Number(currentVehicleId),
    }));
};

module.exports = {
    VEHICLE_STATUSES,
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
