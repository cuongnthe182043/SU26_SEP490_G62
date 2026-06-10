const coordinatorService = require('../services/coordinatorService');

const listVehicleGroups = async (_req, res) => {
  try {
    const vehicleGroups = await coordinatorService.listVehicleGroups();
    res.json({ vehicleGroups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const importExcel = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Vui lòng upload file Excel' });
    }

    const result = await coordinatorService.importExcel(req.user.userId, req.file.buffer);
    res.json({ message: 'Import Excel thành công', ...result });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
};

module.exports = { importExcel, listVehicleGroups };
