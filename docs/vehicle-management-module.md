# Vehicle Management Module

## 1. Functional Requirements

### Vehicle Group Management
- Managers can list all vehicle groups with usage counters.
- Managers can create a vehicle group with pricing and load configuration.
- Managers can update vehicle group details.
- Managers can view vehicle group details including counts by vehicle status.
- Managers cannot delete a vehicle group when any vehicle still references it.
- Vehicle group names must be unique.

### Vehicle Management
- Managers can list vehicles with server-side pagination.
- Managers can search vehicles by plate number.
- Managers can filter vehicles by status.
- Managers can filter vehicles by vehicle group.
- Managers can create vehicles.
- Managers can update vehicles.
- Managers can view vehicle details.
- Managers can change vehicle status independently from full edits.
- Managers can assign or unassign one driver to one vehicle.
- Managers can soft delete a vehicle by setting `status = 'inactive'`.

### Validation Rules
- `plate_number` must be unique.
- `assigned_driver_id` can only point to one vehicle at a time.
- `vehicle_group_id` must exist.
- `manufacture_year` cannot be greater than the current year.
- `load_capacity_kg` must be positive when provided.
- Inactive vehicles cannot keep an assigned driver.

## 2. User Stories

- As a manager, I want to see all vehicle groups so I can manage pricing and capacity categories.
- As a manager, I want to see how many vehicles are using each group so I can understand operational coverage.
- As a manager, I want deletion of an in-use vehicle group to be blocked so I do not break existing vehicle records.
- As a manager, I want to search vehicles by plate number so I can find a vehicle quickly.
- As a manager, I want to filter vehicles by status and group so I can manage maintenance and operations.
- As a manager, I want to assign a driver to a vehicle so dispatch data stays consistent.
- As a manager, I want driver assignment to remain one-to-one so the same driver is not attached to multiple vehicles.
- As a manager, I want to mark a vehicle inactive instead of hard deleting it so historical records remain intact.

## 3. REST API Endpoints

### Vehicle Groups
- `GET /api/admin/vehicle-groups`
- `POST /api/admin/vehicle-groups`
- `GET /api/admin/vehicle-groups/:id`
- `PUT /api/admin/vehicle-groups/:id`
- `DELETE /api/admin/vehicle-groups/:id`

### Vehicles
- `GET /api/admin/vehicles?page=1&limit=10&search=51H&status=available&vehicle_group_id=100000`
- `POST /api/admin/vehicles`
- `GET /api/admin/vehicles/:id`
- `PUT /api/admin/vehicles/:id`
- `PATCH /api/admin/vehicles/:id/status`
- `PATCH /api/admin/vehicles/:id/driver-assignment`
- `DELETE /api/admin/vehicles/:id`
- `GET /api/admin/vehicles/driver-options?vehicle_id=100001`

## 4. Request / Response DTOs

### `CreateVehicleGroupRequest`
```json
{
  "name": "1T25",
  "description": "1.25 ton truck",
  "max_load_weight_kg": 1250,
  "price_per_km": 18000,
  "depreciation_per_km": 1200,
  "upgrade_allowed": true
}
```

### `VehicleGroupResponse`
```json
{
  "id": 100000,
  "name": "1T25",
  "description": "1.25 ton truck",
  "max_load_weight_kg": "1250.00",
  "price_per_km": "18000.00",
  "depreciation_per_km": "1200.00",
  "upgrade_allowed": true,
  "vehicle_count": 4,
  "available_vehicle_count": 2,
  "in_delivery_vehicle_count": 1,
  "maintenance_vehicle_count": 1,
  "inactive_vehicle_count": 0
}
```

### `CreateVehicleRequest`
```json
{
  "plate_number": "51H-12345",
  "vehicle_group_id": 100000,
  "brand": "Hyundai",
  "model": "Porter",
  "load_capacity_kg": 1200,
  "manufacture_year": 2022,
  "purchase_date": "2024-01-15",
  "assigned_driver_id": 100123,
  "status": "available"
}
```

### `VehicleResponse`
```json
{
  "id": 100050,
  "plate_number": "51H-12345",
  "vehicle_group_id": 100000,
  "vehicle_group_name": "1T25",
  "brand": "Hyundai",
  "model": "Porter",
  "load_capacity_kg": "1200.00",
  "manufacture_year": 2022,
  "purchase_date": "2024-01-15",
  "assigned_driver_id": 100123,
  "assigned_driver_name": "Nguyen Van A",
  "assigned_driver_email": "driver1@g62.vn",
  "status": "available"
}
```

### `PagedVehicleListResponse`
```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 32,
    "totalPages": 4
  },
  "filters": {
    "search": "51H",
    "status": "available",
    "vehicle_group_id": 100000
  }
}
```

### `ChangeVehicleStatusRequest`
```json
{
  "status": "maintenance"
}
```

### `AssignDriverRequest`
```json
{
  "assigned_driver_id": 100123
}
```

## 5. Database Queries

### List vehicle groups
```sql
SELECT
    vg.id,
    vg.name,
    vg.description,
    vg.max_load_weight_kg,
    vg.price_per_km,
    vg.depreciation_per_km,
    vg.upgrade_allowed,
    COUNT(v.id)::int AS vehicle_count
FROM vehicle_groups vg
LEFT JOIN vehicles v ON v.vehicle_group_id = vg.id
GROUP BY vg.id
ORDER BY vg.name ASC;
```

### Prevent delete when in use
```sql
SELECT COUNT(*)::int AS total
FROM vehicles
WHERE vehicle_group_id = $1;
```

### List vehicles with filters
```sql
SELECT
    v.id,
    v.plate_number,
    v.status,
    vg.name AS vehicle_group_name,
    p.full_name AS assigned_driver_name
FROM vehicles v
JOIN vehicle_groups vg ON vg.id = v.vehicle_group_id
LEFT JOIN profiles p ON p.id = v.assigned_driver_id
WHERE ($1::text IS NULL OR LOWER(v.plate_number) LIKE LOWER('%' || $1 || '%'))
  AND ($2::text IS NULL OR v.status = $2)
  AND ($3::int IS NULL OR v.vehicle_group_id = $3)
ORDER BY v.updated_at DESC
LIMIT $4 OFFSET $5;
```

### Create vehicle with assignment sync
```sql
BEGIN;

INSERT INTO vehicles (
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
RETURNING id;

UPDATE drivers
SET vehicle_id = $vehicle_id
WHERE profile_id = $assigned_driver_id;

COMMIT;
```

### Reassign / unassign driver transactionally
```sql
BEGIN;

UPDATE drivers
SET vehicle_id = NULL
WHERE vehicle_id = $vehicle_id
  AND ($assigned_driver_id::int IS NULL OR profile_id <> $assigned_driver_id);

UPDATE drivers
SET vehicle_id = $vehicle_id
WHERE profile_id = $assigned_driver_id;

UPDATE vehicles
SET assigned_driver_id = $assigned_driver_id,
    updated_at = NOW()
WHERE id = $vehicle_id;

COMMIT;
```

## 6. Backend Service Design

### Layers
- `vehicleManagementRoutes.js`
  Handles manager-only route registration under `/api/admin`.
- `vehicleManagementController.js`
  Converts HTTP input/output and maps service errors to status codes.
- `vehicleManagementService.js`
  Enforces business rules:
  - unique plate number
  - unique vehicle group name
  - valid vehicle group existence
  - positive capacity
  - no future manufacture year
  - one driver per vehicle
  - soft delete as `inactive`
- `vehicleManagementRepository.js`
  Owns SQL and transaction boundaries for vehicle assignment synchronization.

### Important design note
- The existing codebase uses `drivers.vehicle_id` in trip logic.
- The `vehicles` table also stores `assigned_driver_id`.
- This module updates both columns in the same transaction so the operational trip code stays consistent.

## 7. Suggested React Management Screens

### Vehicle Group List Screen
- Search bar
- Table with name, description, max load, rate, usage counters
- Create button
- Row actions: detail, edit, delete

### Vehicle Group Detail Modal
- Pricing fields
- Upgrade allowed flag
- Vehicle counts by status

### Vehicle List Screen
- Search by plate number
- Status filter
- Vehicle group filter
- Paginated table
- Row actions: detail, edit, assign/unassign driver, change status, inactivate

### Vehicle Detail Modal
- Vehicle master data
- Vehicle group pricing info
- Assigned driver info
- Audit timestamps

### Vehicle Form Modal
- Plate number
- Group selector
- Brand and model
- Load capacity
- Manufacture year
- Purchase date
- Status
- Driver selector with unavailable drivers disabled
