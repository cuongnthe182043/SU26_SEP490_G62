import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VehiclesView from '../../src/pages/Manager/views/VehiclesView';
import { managerService } from '../../src/pages/Manager/services/manager.service';

vi.mock('../../src/hooks/useRoleRealtime', () => ({
  useRoleRealtime: vi.fn(),
}));

vi.mock('../../src/pages/Manager/services/manager.service', () => ({
  managerService: {
    getVehicleGroups: vi.fn(),
    getVehicles: vi.fn(),
    getMaintenanceRequests: vi.fn(),
    getVehicleDetail: vi.fn(),
    getVehicleAssignmentHistory: vi.fn(),
  },
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('VehiclesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    managerService.getVehicleGroups.mockResolvedValue({ vehicleGroups: [{ id: 1, name: 'Group A' }] });
    managerService.getVehicles.mockResolvedValue({
      items: [{ id: 1, plate_number: '29A-123.45', vehicle_group_id: 1, vehicle_group_name: 'Group A', status: 'active' }],
      pagination: { page: 1, limit: 10, total: 1 },
    });
    managerService.getMaintenanceRequests.mockResolvedValue({ requests: [] });
  });

  it('loads and renders vehicles', async () => {
    render(<VehiclesView user={{ role: 'manager' }} />);

    await waitFor(() => {
      expect(managerService.getVehicleGroups).toHaveBeenCalled();
      expect(managerService.getVehicles).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
      expect(screen.getByText('29A-123.45')).toBeInTheDocument();
    });
  });

  it('applies vehicle search filter', async () => {
    render(<VehiclesView user={{ role: 'manager' }} />);
    await waitFor(() => expect(screen.getByText('29A-123.45')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Tìm theo biển số/i), {
      target: { value: '29A' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Áp dụng/i }));

    await waitFor(() => {
      expect(managerService.getVehicles).toHaveBeenCalledWith(expect.objectContaining({ search: '29A', page: 1 }));
    });
  });
});
