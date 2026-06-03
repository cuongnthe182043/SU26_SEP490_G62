const incidentRepository = require('../repositories/incidentRepository');
const tripRepository     = require('../repositories/tripRepository');
const {
    ALLOWED_INCIDENT_TYPES,
    ALLOWED_SEVERITIES,
    INCIDENT_SEVERITY,
    MAX_IMAGES_PER_INCIDENT,
} = require('../constants/incidentConstants');

const ACTIVE_STATUSES = ['claimed', 'picking', 'loaded', 'transit', 'arrived', 'failed', 'returning'];

const TYPE_LABEL = {
    vehicle_breakdown: 'Sự cố xe',
    cargo_damage:      'Hàng hóa',
    road_incident:     'Đường sá / giao thông',
    other:             'Khác',
};

// ─── Create incident ──────────────────────────────────────────────────────────

const createIncident = async (driverId, { shipmentId, incidentType, severityLevel, description, location }, imageUrls = []) => {
    // Validate type
    if (!incidentType || !ALLOWED_INCIDENT_TYPES.includes(incidentType)) {
        throw new Error('Loại sự cố không hợp lệ');
    }

    // Validate description (required per spec)
    if (!description || !description.trim()) {
        throw new Error('Mô tả sự cố là bắt buộc');
    }
    if (description.trim().length < 10) {
        throw new Error('Mô tả sự cố phải có ít nhất 10 ký tự');
    }

    // Validate severity
    const severity = severityLevel && ALLOWED_SEVERITIES.includes(severityLevel)
        ? severityLevel
        : INCIDENT_SEVERITY.MEDIUM;

    // Validate shipment ownership and status
    const shipment = await tripRepository.getTripById(shipmentId);
    if (!shipment) throw new Error('Chuyến vận chuyển không tồn tại');
    if (Number(shipment.owner_driver_id) !== Number(driverId)) {
        throw new Error('Bạn không có quyền báo sự cố cho chuyến này');
    }
    if (!ACTIVE_STATUSES.includes(shipment.status)) {
        throw new Error('Chỉ có thể báo sự cố khi chuyến đang hoạt động');
    }

    // Max images
    if (imageUrls.length > MAX_IMAGES_PER_INCIDENT) {
        throw new Error(`Tối đa ${MAX_IMAGES_PER_INCIDENT} ảnh minh chứng`);
    }

    // Create incident record
    const incident = await incidentRepository.createIncident({
        shipmentId,
        reportedBy: driverId,
        incidentType,
        severityLevel: severity,
        description: description.trim(),
        location: location?.trim() || null,
    });

    // Save evidence images
    await Promise.all(imageUrls.map((url) => incidentRepository.addIncidentEvidence(incident.id, url)));

    // Notify all coordinators
    const coordinatorIds = await incidentRepository.getCoordinatorIds();
    if (coordinatorIds.length > 0) {
        await incidentRepository.insertNotifications(coordinatorIds, {
            title: `Sự cố mới: ${TYPE_LABEL[incidentType]}`,
            body:  `Tài xế báo cáo sự cố trên chuyến #${shipmentId}: ${description.trim().slice(0, 80)}`,
            entityId: incident.id,
        });
    }

    return incidentRepository.getIncidentById(incident.id);
};

// ─── Get driver's incidents ───────────────────────────────────────────────────

const getMyIncidents = async (driverId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const { rows, total } = await incidentRepository.getIncidentsByDriver(driverId, { limit, offset });
    return {
        incidents: rows,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

// ─── Get single incident ──────────────────────────────────────────────────────

const getIncidentDetail = async (incidentId, driverId) => {
    const incident = await incidentRepository.getIncidentById(incidentId);
    if (!incident) throw new Error('Sự cố không tồn tại');
    if (Number(incident.reported_by) !== Number(driverId)) {
        throw new Error('Bạn không có quyền xem sự cố này');
    }
    return incident;
};

module.exports = { createIncident, getMyIncidents, getIncidentDetail };
