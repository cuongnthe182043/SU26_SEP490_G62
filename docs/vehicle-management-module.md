# Vehicle Management Module

## Current Design After Refactor

The manager vehicle module no longer treats `vehicles.status` as a free-form editable field.
Status is now derived from explicit manager lifecycle actions:

- `ACTIVE` → `Send to maintenance`
- `MAINTENANCE` → `Complete maintenance`
- `ACTIVE` → `Mark broken`
- `BROKEN` → `Restore vehicle`
- `ACTIVE|MAINTENANCE|BROKEN` → `Retire vehicle`

Invalid transitions are blocked in the service layer, including:

- `RETIRED -> ACTIVE`
- `RETIRED -> MAINTENANCE`
- `RETIRED -> BROKEN`
- Any direct status edit through generic vehicle update

## Database Changes

### Existing table reused
- `vehicles.status`
  Allowed values: `active`, `maintenance`, `broken`, `retired`

### Extended table
- `maintenance_records`
  Added workflow fields:
  - `status` (`open|completed`)
  - `started_at`
  - `completed_at`
  - `completion_note`
  - `created_by`
  - `completed_by`
  - `updated_at`

### Existing table reused
- `incidents`
  Manager-side broken/restore actions reuse the existing incident model with:
  - `incident_type = 'vehicle_breakdown'`
  - `shipment_id = NULL`
  - `vehicle_id = <vehicle>`

- `vehicle_status_history`
  Stores auditable lifecycle events:
  - `send_to_maintenance`
  - `complete_maintenance`
  - `mark_broken`
  - `restore_vehicle`
  - `retire_vehicle`

## Backend Structure

### Repository
- `backend/repositories/vehicleManagementRepository.js`
  - exposes lifecycle-aware list/detail queries
  - creates and closes maintenance/breakdown incident records transactionally
  - writes `vehicle_status_history`
  - retires vehicles by clearing assignment and setting status

### Service
- `backend/services/vehicleManagementService.js`
  - forbids direct status edits
  - validates transitions
  - maps legacy `PATCH /vehicles/:id/status` to valid lifecycle actions only
  - enforces active-only driver assignment

### Controller + Routes
- `backend/controllers/vehicleManagementController.js`
- `backend/routes/vehicleManagementRoutes.js`

New manager endpoints:

- `POST /api/admin/vehicles/:id/send-to-maintenance`
- `POST /api/admin/vehicles/:id/complete-maintenance`
- `POST /api/admin/vehicles/:id/mark-broken`
- `POST /api/admin/vehicles/:id/restore`
- `POST /api/admin/vehicles/:id/retire`

Compatibility endpoint retained:

- `PATCH /api/admin/vehicles/:id/status`
  Only succeeds when the requested transition corresponds to a valid lifecycle action.

## UI Changes

### Vehicle form
- `frontend/src/features/admin/VehicleModal.jsx`
  - removed direct status dropdown
  - kept vehicle master-data editing only

### Vehicle list
- `frontend/src/features/admin/VehicleList.jsx`
  - replaced status dropdown with action buttons
  - added lifecycle dialogs for maintenance/broken/restore/retire
  - detail modal now shows:
    - current open maintenance
    - current open breakdown incident
    - status history timeline

### Vehicle group list
- `frontend/src/features/admin/VehicleGroupList.jsx`
  - updated counters to `active / maintenance / broken / retired`

## Migration Strategy

1. Apply the schema update in `DB script/DB script.sql`.
2. Migrate existing open maintenance rows:
   - old rows become `status = 'open'` if the vehicle is currently `maintenance`
   - otherwise mark historical rows as `completed`
3. Seed `vehicle_status_history` for known current non-active states if historical provenance is missing.
4. For any currently broken vehicles, create one open `incidents` row per vehicle with `incident_type = 'vehicle_breakdown'`, `shipment_id = NULL`, and `vehicle_id` set.
5. Deploy backend before frontend so old clients still hit the compatibility endpoint instead of failing on removed status actions.
6. Deploy frontend after backend to switch managers to lifecycle buttons.

## Operational Rules

- Retired vehicles cannot be assigned to drivers.
- Order/coordinator flows now reject non-`active` vehicles for future assignments/imported assignments.
- Existing incident storage is reused for manager-side vehicle breakdowns without adding driver-side UI or workflow to this feature.
