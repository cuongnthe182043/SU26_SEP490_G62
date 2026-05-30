const pool = require('../config/database');

// Get all roles
const getAllRoles = async () => {
    const result = await pool.query('SELECT * FROM roles ORDER BY id');
    return result.rows;
};

// Get role by ID
const getRoleById = async (roleId) => {
    const result = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
    return result.rows[0];
};

// Get role by name
const getRoleByName = async (roleName) => {
    const result = await pool.query('SELECT * FROM roles WHERE name = $1', [roleName]);
    return result.rows[0];
};

module.exports = {
    getAllRoles,
    getRoleById,
    getRoleByName,
};
