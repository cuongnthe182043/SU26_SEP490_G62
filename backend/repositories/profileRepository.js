const pool = require('../config/database');

// Get profile with role info
const getProfileWithRole = async (profileId) => {
    const result = await pool.query(
        `SELECT p.id, a.email, p.full_name, p.phone, p.role_id, r.name as role 
         FROM profiles p 
         JOIN accounts a ON p.id = a.id 
         JOIN roles r ON p.role_id = r.id 
         WHERE p.id = $1`,
        [profileId]
    );
    return result.rows[0];
};

// Get account by email with password hash
const getAccountByEmail = async (email) => {
    const result = await pool.query(
        `SELECT a.id, a.email, a.password_hash, p.full_name, p.phone, r.name as role 
         FROM accounts a 
         JOIN profiles p ON a.id = p.id 
         JOIN roles r ON p.role_id = r.id 
         WHERE a.email = $1 AND p.is_active = TRUE`,
        [email]
    );
    return result.rows[0];
};

// Get profile by ID
const getProfileById = async (profileId) => {
    const result = await pool.query(
        'SELECT id, full_name, email, phone, role_id, is_active FROM profiles WHERE id = $1',
        [profileId]
    );
    return result.rows[0];
};

// Update last login
const updateLastLogin = async (accountId) => {
    const result = await pool.query(
        'UPDATE accounts SET last_login = NOW() WHERE id = $1 RETURNING id',
        [accountId]
    );
    return result.rows[0];
};

module.exports = {
    getProfileWithRole,
    getAccountByEmail,
    getProfileById,
    updateLastLogin,
};
