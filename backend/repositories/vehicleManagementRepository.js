const pool = require('../config/database');

const VEHICLE_GROUP_DETAIL_SELECT = `
    SELECT
        vg.id,
        vg.name,
        vg.description,
        vg.max_load_weight_kg,
        vg.price_per_km,
        vg.depreciation_per_km,
        vg.upgrade_allowed,
        vg.created_at,
        COUNT(v.id)::int AS vehicle_count,
        COUNT(*) FILTER (WHERE v.status = 'available')::int AS available_vehicle_count,
        COUNT(*) FILTER (WHERE v.status = 'in_delivery')::int AS in_delivery_vehicle_count,
        COUNT(*) FILTER (WHERE v.status = 'maintenance')::int AS maintenance_vehicle_count,
        COUNT(*) FILTER (WHERE v.status = 'inactive')::int AS inactive_vehicle_count
    FROM vehicle_groups vg
    LEFT JOIN vehicles v ON v.vehicle_group_id = vg.id
`;

const VEHICLE_DETAIL_SELECT = `
    SELECT
        v.id,
        v.plate_number,
        v.vehicle_group_id,
        vg.name AS vehicle_group_name,
        vg.price_per_km,
        vg.depreciation_per_km,
        vg.upgrade_allowed,
        v.brand,
        v.model,
        v.load_capacity_kg,
        v.manufacture_year,
        v.purchase_date,
        v.assigned_driver_id,
        p.full_name AS assigned_driver_name,
        a.email AS assigned_driver_email,
        d.license_number AS assigned_driver_license_number,
        v.status,
        v.created_at,
        v.updated_at
    FROM vehicles v
    JOIN vehicle_groups vg ON vg.id = v.vehicle_group_id
    LEFT JOIN profiles p ON p.id = v.assigned_driver_id
    LEFT JOIN accounts a ON a.id = v.assigned_driver_id
    LEFT JOIN drivers d ON d.profile_id = v.assigned_driver_id
`;

const listVehicleGroups = async () => {
    const result = await pool.query(
        `${VEHICLE_GROUP_DETAIL_SELECT}
         GROUP BY vg.id
         ORDER BY vg.name ASC, vg.id ASC`,
    );
    return result.rows;
};

const getVehicleGroupById = async (vehicleGroupId) => {
    const result = await pool.query(
        `${VEHICLE_GROUP_DETAIL_SELECT}
         WHERE vg.id = $1
         GROUP BY vg.id`,
        [vehicleGroupId],
    );
    return result.rows[0] ?? null;
};

const getVehicleGroupByName = async (name, excludeId = null) => {
    const params = [name.trim().toLowerCase()];
    let whereClause = 'WHERE LOWER(name) = $1';

    if (excludeId !== null) {
        params.push(excludeId);
        whereClause += ` AND id <> $${params.length}`;
    }

    const result = await pool.query(
        `SELECT id, name
         FROM vehicle_groups
         ${whereClause}
         LIMIT 1`,
        params,
    );
    return result.rows[0] ?? null;
};

const createVehicleGroup = async ({
    name,
    description,
    max_load_weight_kg,
    price_per_km,
    depreciation_per_km,
    upgrade_allowed,
}) => {
    const result = await pool.query(
        `INSERT INTO vehicle_groups (
            name,
            description,
            max_load_weight_kg,
            price_per_km,
            depreciation_per_km,
            upgrade_allowed
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
            name,
            description,
            max_load_weight_kg,
            price_per_km,
            depreciation_per_km,
            upgrade_allowed,
        ],
    );
    return result.rows[0]?.id ?? null;
};

const updateVehicleGroup = async (
    vehicleGroupId,
    {
        name,
        description,
        max_load_weight_kg,
        price_per_km,
        depreciation_per_km,
        upgrade_allowed,
    },
) => {
    const result = await pool.query(
        `UPDATE vehicle_groups
         SET
            name = $2,
            description = $3,
            max_load_weight_kg = $4,
            price_per_km = $5,
            depreciation_per_km = $6,
            upgrade_allowed = $7
         WHERE id = $1
         RETURNING id`,
        [
            vehicleGroupId,
            name,
            description,
            max_load_weight_kg,
            price_per_km,
            depreciation_per_km,
            upgrade_allowed,
        ],
    );
    return result.rows[0] ?? null;
};

const countVehiclesByGroupId = async (vehicleGroupId) => {
    const result = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM vehicles
         WHERE vehicle_group_id = $1`,
        [vehicleGroupId],
    );
    return Number(result.rows[0]?.total ?? 0);
};

const deleteVehicleGroup = async (vehicleGroupId) => {
    const result = await pool.query(
        `DELETE FROM vehicle_groups
         WHERE id = $1
         RETURNING id`,
        [vehicleGroupId],
    );
    return result.rows[0] ?? null;
};

const listVehicles = async ({
    page = 1,
    limit = 10,
    search = null,
    status = null,
    vehicleGroupId = null,
} = {}) => {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (search) {
        params.push(`%${search.trim().toLowerCase()}%`);
        conditions.push(`LOWER(v.plate_number) LIKE $${params.length}`);
    }

    if (status) {
        params.push(status);
        conditions.push(`v.status = $${params.length}`);
    }

    if (vehicleGroupId) {
        params.push(vehicleGroupId);
        conditions.push(`v.vehicle_group_id = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countParams = [...params];
    const rowsParams = [...params, limit, offset];

    const [countResult, rowsResult] = await Promise.all([
        pool.query(
            `SELECT COUNT(*)::int AS total
             FROM vehicles v
             ${whereClause}`,
            countParams,
        ),
        pool.query(
            `${VEHICLE_DETAIL_SELECT}
             ${whereClause}
             ORDER BY v.updated_at DESC, v.id DESC
             LIMIT $${rowsParams.length - 1} OFFSET $${rowsParams.length}`,
            rowsParams,
        ),
    ]);

    return {
        rows: rowsResult.rows,
        total: Number(countResult.rows[0]?.total ?? 0),
    };
};

const getVehicleById = async (vehicleId, db = pool) => {
    const result = await db.query(
        `${VEHICLE_DETAIL_SELECT}
         WHERE v.id = $1`,
        [vehicleId],
    );
    return result.rows[0] ?? null;
};

const getVehicleByPlateNumber = async (plateNumber, excludeId = null, db = pool) => {
    const params = [plateNumber.trim().toLowerCase()];
    let whereClause = 'WHERE LOWER(v.plate_number) = $1';

    if (excludeId !== null) {
        params.push(excludeId);
        whereClause += ` AND v.id <> $${params.length}`;
    }

    const result = await db.query(
        `SELECT v.id, v.plate_number
         FROM vehicles v
         ${whereClause}
         LIMIT 1`,
        params,
    );
    return result.rows[0] ?? null;
};

const getVehicleGroupReferenceById = async (vehicleGroupId, db = pool) => {
    const result = await db.query(
        `SELECT id, name
         FROM vehicle_groups
         WHERE id = $1`,
        [vehicleGroupId],
    );
    return result.rows[0] ?? null;
};

const getDriverById = async (driverId, db = pool) => {
    const result = await db.query(
        `SELECT
            d.profile_id AS id,
            d.vehicle_id,
            p.full_name,
            a.email,
            d.license_number
         FROM drivers d
         JOIN profiles p ON p.id = d.profile_id
         JOIN accounts a ON a.id = d.profile_id
         WHERE d.profile_id = $1`,
        [driverId],
    );
    return result.rows[0] ?? null;
};

const listDriverOptions = async () => {
    const result = await pool.query(
        `SELECT
            d.profile_id AS id,
            p.full_name,
            a.email,
            d.license_number,
            d.vehicle_id AS current_vehicle_id,
            v.plate_number AS current_vehicle_plate,
            v.status AS current_vehicle_status
         FROM drivers d
         JOIN profiles p ON p.id = d.profile_id
         JOIN accounts a ON a.id = d.profile_id
         LEFT JOIN vehicles v ON v.id = d.vehicle_id
         ORDER BY p.full_name ASC, d.profile_id ASC`,
    );
    return result.rows;
};

const createVehicle = async ({
    plate_number,
    vehicle_group_id,
    brand,
    model,
    load_capacity_kg,
    manufacture_year,
    purchase_date,
    assigned_driver_id,
    status,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO vehicles (
                plate_number,
                vehicle_group_id,
                brand,
                model,
                load_capacity_kg,
                manufacture_year,
                purchase_date,
                assigned_driver_id,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id`,
            [
                plate_number,
                vehicle_group_id,
                brand,
                model,
                load_capacity_kg,
                manufacture_year,
                purchase_date,
                assigned_driver_id,
                status,
            ],
        );

        const vehicleId = result.rows[0]?.id;
        if (assigned_driver_id) {
            await client.query(
                `UPDATE drivers
                 SET vehicle_id = $1
                 WHERE profile_id = $2`,
                [vehicleId, assigned_driver_id],
            );
        }

        await client.query('COMMIT');
        return vehicleId;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const updateVehicle = async (
    vehicleId,
    {
        plate_number,
        vehicle_group_id,
        brand,
        model,
        load_capacity_kg,
        manufacture_year,
        purchase_date,
        assigned_driver_id,
        status,
    },
) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const currentVehicleResult = await client.query(
            `SELECT id, assigned_driver_id
             FROM vehicles
             WHERE id = $1
             FOR UPDATE`,
            [vehicleId],
        );
        const currentVehicle = currentVehicleResult.rows[0];
        if (!currentVehicle) {
            await client.query('ROLLBACK');
            return null;
        }

        await client.query(
            `SELECT profile_id
             FROM drivers
             WHERE vehicle_id = $1
             FOR UPDATE`,
            [vehicleId],
        );

        await client.query(
            `UPDATE drivers
             SET vehicle_id = NULL
             WHERE vehicle_id = $1
               AND ($2::int IS NULL OR profile_id <> $2)`,
            [vehicleId, assigned_driver_id],
        );

        if (assigned_driver_id) {
            await client.query(
                `UPDATE drivers
                 SET vehicle_id = $1
                 WHERE profile_id = $2`,
                [vehicleId, assigned_driver_id],
            );
        }

        const result = await client.query(
            `UPDATE vehicles
             SET
                plate_number = $2,
                vehicle_group_id = $3,
                brand = $4,
                model = $5,
                load_capacity_kg = $6,
                manufacture_year = $7,
                purchase_date = $8,
                assigned_driver_id = $9,
                status = $10,
                updated_at = NOW()
             WHERE id = $1
             RETURNING id`,
            [
                vehicleId,
                plate_number,
                vehicle_group_id,
                brand,
                model,
                load_capacity_kg,
                manufacture_year,
                purchase_date,
                assigned_driver_id,
                status,
            ],
        );

        if (currentVehicle.assigned_driver_id && currentVehicle.assigned_driver_id !== assigned_driver_id) {
            await client.query(
                `UPDATE drivers
                 SET vehicle_id = NULL
                 WHERE profile_id = $1
                   AND vehicle_id = $2`,
                [currentVehicle.assigned_driver_id, vehicleId],
            );
        }

        await client.query('COMMIT');
        return result.rows[0] ?? null;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = {
    listVehicleGroups,
    getVehicleGroupById,
    getVehicleGroupByName,
    createVehicleGroup,
    updateVehicleGroup,
    countVehiclesByGroupId,
    deleteVehicleGroup,
    listVehicles,
    getVehicleById,
    getVehicleByPlateNumber,
    getVehicleGroupReferenceById,
    getDriverById,
    listDriverOptions,
    createVehicle,
    updateVehicle,
};
