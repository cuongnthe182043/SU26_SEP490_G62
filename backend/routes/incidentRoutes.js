const express = require('express');

const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadIncident }           = require('../middleware/uploadMiddleware');
const incidentController           = require('../controllers/incidentController');

const driverOnly = [verifyToken, requireRole('driver')];

function handleUpload(middleware) {
    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (err) return res.status(422).json({ error: err.message });
            next();
        });
    };
}

// POST /api/incidents  — báo sự cố (kèm tối đa 3 ảnh)
router.post(
    '/',
    driverOnly,
    handleUpload(uploadIncident.array('images', 3)),
    incidentController.createIncident,
);

// GET /api/incidents/my  — lịch sử sự cố của driver
router.get('/my', driverOnly, incidentController.getMyIncidents);

// GET /api/incidents/:id  — chi tiết 1 sự cố
router.get('/:id', driverOnly, incidentController.getIncidentDetail);

module.exports = router;
