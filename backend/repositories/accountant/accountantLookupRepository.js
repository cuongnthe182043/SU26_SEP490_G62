const pool = require('../../config/database');

const getVehicleDriverLookup = async () => {
    const [vehiclesResult, driversResult, customersResult] = await Promise.all([
        pool.query(
            `SELECT
                v.id,
                v.plate_number,
                v.status,
                v.assigned_driver_id,
                vg.name AS vehicle_group_name,
                p.full_name AS assigned_driver_name
             FROM vehicles v
             LEFT JOIN vehicle_groups vg ON vg.id = v.vehicle_group_id
             LEFT JOIN profiles p ON p.id = v.assigned_driver_id
             ORDER BY v.plate_number ASC`
        ),
        pool.query(
            `SELECT
                d.profile_id AS id,
                p.full_name,
                d.vehicle_id,
                v.plate_number,
                v.status AS vehicle_status,
                vg.name AS vehicle_group_name
             FROM drivers d
             JOIN profiles p ON p.id = d.profile_id
             LEFT JOIN vehicles v ON v.id = d.vehicle_id
             LEFT JOIN vehicle_groups vg ON vg.id = v.vehicle_group_id
             ORDER BY p.full_name ASC`
        ),
        // Individual customers
        pool.query(
            `SELECT id, full_name, phone, company_name
             FROM customers
             WHERE customer_type = 'individual'
             ORDER BY full_name ASC
             LIMIT 200`
        ),
    ]);

    return {
        vehicles: vehiclesResult.rows,
        drivers: driversResult.rows,
        customers: customersResult.rows,
    };
};

module.exports = {
    getVehicleDriverLookup,
};
