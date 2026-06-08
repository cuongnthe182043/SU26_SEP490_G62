import { apiRequest } from "../../services/apiClient";

const getToken = () => localStorage.getItem("token");

export async function fetchVehicleGroups() {
  return apiRequest("/api/admin/vehicle-groups", { token: getToken() });
}

export async function fetchVehicleGroupDetail(id) {
  return apiRequest(`/api/admin/vehicle-groups/${id}`, { token: getToken() });
}

export async function createVehicleGroup(payload) {
  return apiRequest("/api/admin/vehicle-groups", {
    method: "POST",
    body: payload,
    token: getToken(),
  });
}

export async function updateVehicleGroup(id, payload) {
  return apiRequest(`/api/admin/vehicle-groups/${id}`, {
    method: "PUT",
    body: payload,
    token: getToken(),
  });
}

export async function deleteVehicleGroup(id) {
  return apiRequest(`/api/admin/vehicle-groups/${id}`, {
    method: "DELETE",
    token: getToken(),
  });
}

export async function fetchVehicles(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return apiRequest(`/api/admin/vehicles${query ? `?${query}` : ""}`, {
    token: getToken(),
  });
}

export async function fetchVehicleDetail(id) {
  return apiRequest(`/api/admin/vehicles/${id}`, { token: getToken() });
}

export async function createVehicle(payload) {
  return apiRequest("/api/admin/vehicles", {
    method: "POST",
    body: payload,
    token: getToken(),
  });
}

export async function updateVehicle(id, payload) {
  return apiRequest(`/api/admin/vehicles/${id}`, {
    method: "PUT",
    body: payload,
    token: getToken(),
  });
}

export async function changeVehicleStatus(id, status) {
  return apiRequest(`/api/admin/vehicles/${id}/status`, {
    method: "PATCH",
    body: { status },
    token: getToken(),
  });
}

export async function assignVehicleDriver(id, assignedDriverId) {
  return apiRequest(`/api/admin/vehicles/${id}/driver-assignment`, {
    method: "PATCH",
    body: { assigned_driver_id: assignedDriverId ?? null },
    token: getToken(),
  });
}

export async function softDeleteVehicle(id) {
  return apiRequest(`/api/admin/vehicles/${id}`, {
    method: "DELETE",
    token: getToken(),
  });
}

export async function fetchDriverOptions(vehicleId) {
  const query = vehicleId ? `?vehicle_id=${vehicleId}` : "";
  return apiRequest(`/api/admin/vehicles/driver-options${query}`, {
    token: getToken(),
  });
}
