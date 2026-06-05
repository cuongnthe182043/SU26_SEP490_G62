const INCIDENT_TYPE = Object.freeze({
    VEHICLE_BREAKDOWN: 'vehicle_breakdown',
    CARGO_DAMAGE:      'cargo_damage',
    ROAD_INCIDENT:     'road_incident',
    OTHER:             'other',
});

const INCIDENT_STATUS = Object.freeze({
    OPEN:          'open',
    INVESTIGATING: 'investigating',
    RESOLVED:      'resolved',
    CLOSED:        'closed',
});

const INCIDENT_SEVERITY = Object.freeze({
    LOW:      'low',
    MEDIUM:   'medium',
    HIGH:     'high',
    CRITICAL: 'critical',
});

const ALLOWED_INCIDENT_TYPES   = Object.values(INCIDENT_TYPE);
const ALLOWED_INCIDENT_STATUSES = Object.values(INCIDENT_STATUS);
const ALLOWED_SEVERITIES        = Object.values(INCIDENT_SEVERITY);

const MAX_IMAGES_PER_INCIDENT = 3;

module.exports = {
    INCIDENT_TYPE,
    INCIDENT_STATUS,
    INCIDENT_SEVERITY,
    ALLOWED_INCIDENT_TYPES,
    ALLOWED_INCIDENT_STATUSES,
    ALLOWED_SEVERITIES,
    MAX_IMAGES_PER_INCIDENT,
};
