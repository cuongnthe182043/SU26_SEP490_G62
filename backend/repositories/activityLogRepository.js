const pool = require('../config/database');

// Nhật ký hoạt động (audit trail) — mục 27 spec: User + Timestamp + Action + Before + After.
// Ghi vào bảng activity_logs (old_data/new_data = JSONB giá trị trước/sau).
//
// - `db` có thể là pool hoặc client (trong transaction) — dùng client khi muốn audit
//   cùng commit/rollback với nghiệp vụ; dùng pool cho audit độc lập (append-only).
// - KHÔNG được để lỗi ghi audit làm hỏng nghiệp vụ chính: caller nên gọi kèm .catch(()=>{})
//   khi ghi ngoài transaction, hoặc dùng logSafe() bên dưới.
const log = async (db, { userId = null, action, entityType, entityId = null, oldData = null, newData = null, ipAddress = null }) => {
    await db.query(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            userId,
            action,
            entityType,
            entityId,
            oldData != null ? JSON.stringify(oldData) : null,
            newData != null ? JSON.stringify(newData) : null,
            ipAddress,
        ],
    );
};

// Ghi audit "an toàn" — nuốt lỗi để không bao giờ làm hỏng nghiệp vụ chính. Dùng pool.
const logSafe = (entry) => log(pool, entry).catch((err) => {
    console.error('[activityLog] ghi audit thất bại:', err.message);
});

module.exports = { log, logSafe };
