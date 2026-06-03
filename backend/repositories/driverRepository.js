const pool = require('../config/database');

const getAllDrivers = async () => {
    const result = await pool.query(
        `SELECT
            d.profile_id AS id,
            p.full_name,
            a.email,
            d.license_number,
            d.vehicle_id,
            v.plate_number,
            v.vehicle_group_id
         FROM drivers d
         JOIN profiles p ON p.id = d.profile_id
         JOIN accounts a ON a.id = d.profile_id
         LEFT JOIN vehicles v ON v.id = d.vehicle_id
         ORDER BY p.full_name ASC`,
    );
    return result.rows;
};

module.exports = { getAllDrivers };
