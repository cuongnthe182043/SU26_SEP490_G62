const multer = require('multer');

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]);

    if (!allowedTypes.has(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls)'));
    }

    cb(null, true);
  },
});

module.exports = { uploadExcel };
