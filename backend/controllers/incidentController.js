const incidentService = require('../services/incidentService');

// ─── POST /api/incidents ──────────────────────────────────────────────────────

const createIncident = async (req, res) => {
    try {
        const driverId = req.user.userId;
        const { shipmentId, incidentType, severityLevel, description, location } = req.body;

        if (!shipmentId) return res.status(400).json({ error: 'shipmentId là bắt buộc' });

        const imageUrls = (req.files ?? []).map((f) => f.path);

        const incident = await incidentService.createIncident(
            driverId,
            {
                shipmentId: Number(shipmentId),
                incidentType,
                severityLevel,
                description,
                location,
            },
            imageUrls,
        );

        res.status(201).json({ incident });
    } catch (err) {
        const status = err.message.includes('không tồn tại') ? 404
            : err.message.includes('quyền') ? 403
            : err.message.includes('không hợp lệ') || err.message.includes('bắt buộc') || err.message.includes('ít nhất') || err.message.includes('Tối đa') ? 400
            : err.message.includes('đang hoạt động') ? 422
            : 500;
        res.status(status).json({ error: err.message });
    }
};

// ─── GET /api/incidents/my ────────────────────────────────────────────────────

const getMyIncidents = async (req, res) => {
    try {
        const driverId = req.user.userId;
        const page     = Math.max(1, Number(req.query.page) || 1);
        const limit    = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

        const data = await incidentService.getMyIncidents(driverId, page, limit);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/incidents/:id ───────────────────────────────────────────────────

const getIncidentDetail = async (req, res) => {
    try {
        const incidentId = Number(req.params.id);
        if (!incidentId) return res.status(400).json({ error: 'ID không hợp lệ' });

        const incident = await incidentService.getIncidentDetail(incidentId, req.user.userId);
        res.json({ incident });
    } catch (err) {
        const status = err.message.includes('không tồn tại') ? 404
            : err.message.includes('quyền') ? 403
            : 500;
        res.status(status).json({ error: err.message });
    }
};

// ─── PATCH /api/incidents/:id/status  (coordinator only) ─────────────────────

const updateIncidentStatus = async (req, res) => {
    try {
        const incidentId   = Number(req.params.id);
        const coordinatorId = req.user.userId;
        if (!incidentId) return res.status(400).json({ error: 'ID không hợp lệ' });

        const { status, resolution } = req.body;
        if (!status) return res.status(400).json({ error: 'status là bắt buộc' });

        const incident = await incidentService.updateIncidentStatus(incidentId, coordinatorId, { status, resolution });
        res.json({ incident });
    } catch (err) {
        const code = err.message.includes('không tồn tại') ? 404
            : err.message.includes('không hợp lệ') ? 400
            : 500;
        res.status(code).json({ error: err.message });
    }
};

module.exports = { createIncident, getMyIncidents, getIncidentDetail, updateIncidentStatus };
