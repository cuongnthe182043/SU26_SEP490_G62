const pool = require('../config/database');

const ALLOWED_UPDATE_FIELDS = ['full_name', 'phone', 'dob', 'gender', 'address', 'city', 'country'];

const getAccountByEmail = async (email) => {
    const result = await pool.query(
        `SELECT a.id, a.email, a.password_hash, p.full_name, p.phone, r.name as role
         FROM accounts a
         JOIN profiles p ON a.id = p.id
         JOIN roles r ON p.role_id = r.id
         WHERE a.email = $1 AND p.is_active = TRUE`,
        [email],
    );
    return result.rows[0];
};

const getProfileWithRole = async (profileId) => {
    const result = await pool.query(
        `SELECT p.id, a.email, p.full_name, p.phone, p.role_id, r.name as role
         FROM profiles p
         JOIN accounts a ON p.id = a.id
         JOIN roles r ON p.role_id = r.id
         WHERE p.id = $1`,
        [profileId],
    );
    return result.rows[0];
};

// Full profile including new columns
const getFullProfile = async (userId) => {
    const result = await pool.query(
        `SELECT
            p.id,
            a.email,
            p.full_name,
            p.phone,
            p.role_id,
            r.name        AS role,
            p.avatar_url,
            p.dob,
            p.gender,
            p.address,
            p.city,
            p.country,
            p.is_active,
            p.created_at,
            p.updated_at
         FROM profiles p
         JOIN accounts a ON p.id = a.id
         JOIN roles r ON p.role_id = r.id
         WHERE p.id = $1`,
        [userId],
    );
    return result.rows[0] ?? null;
};

// Only allow updating whitelisted columns
const updateProfile = async (userId, data) => {
    const fields = Object.keys(data).filter((k) => ALLOWED_UPDATE_FIELDS.includes(k));
    if (fields.length === 0) return getFullProfile(userId);

    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => data[f]);

    const result = await pool.query(
        `UPDATE profiles
         SET ${setClauses}, updated_at = NOW()
         WHERE id = $1
         RETURNING id, full_name, phone, dob, gender, address, city, country, avatar_url, updated_at`,
        [userId, ...values],
    );
    return result.rows[0];
};

const updateAvatar = async (userId, avatarUrl) => {
    const result = await pool.query(
        `UPDATE profiles
         SET avatar_url = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING avatar_url`,
        [userId, avatarUrl],
    );
    return result.rows[0];
};

const updateLastLogin = async (accountId) => {
    const result = await pool.query(
        'UPDATE accounts SET last_login_at = NOW() WHERE id = $1 RETURNING id',
        [accountId],
    );
    return result.rows[0];
};

const getProfileById = async (profileId) => {
    const result = await pool.query(
        'SELECT id, full_name, email, phone, role_id, is_active FROM profiles WHERE id = $1',
        [profileId],
    );
    return result.rows[0];
};

module.exports = {
    getAccountByEmail,
    getProfileWithRole,
    getFullProfile,
    updateProfile,
    updateAvatar,
    updateLastLogin,
    getProfileById,
};
