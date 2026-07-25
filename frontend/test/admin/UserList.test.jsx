import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UsersView from '../../src/pages/Manager/views/UsersView';
import { managerService } from '../../src/pages/Manager/services/manager.service';

vi.mock('../../src/hooks/useRoleRealtime', () => ({
  useRoleRealtime: vi.fn(),
}));

vi.mock('../../src/pages/Manager/services/manager.service', () => ({
  managerService: {
    getUsers: vi.fn(),
    toggleUserStatus: vi.fn(),
    resetUserPassword: vi.fn(),
  },
}));

const mockUsers = [
  { id: 1, email: 'admin@test.com', full_name: 'Admin User', phone: '0123456789', role: 'manager', is_active: true, city: 'Ha Noi' },
  { id: 2, email: 'coord@test.com', full_name: 'Coordinator User', phone: '0987654321', role: 'coordinator', is_active: true, city: 'Da Nang' },
  { id: 3, email: 'driver@test.com', full_name: 'Driver User', phone: '0999999999', role: 'driver', is_active: false, city: 'Hue' },
];

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

describe('UsersView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    managerService.getUsers.mockResolvedValue({ users: mockUsers });
  });

  it('loads and renders manager users', async () => {
    render(<UsersView user={{ role: 'manager' }} />);

    await waitFor(() => {
      expect(managerService.getUsers).toHaveBeenCalled();
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Coordinator User')).toBeInTheDocument();
      expect(screen.getByText('Driver User')).toBeInTheDocument();
    });
  });

  it('filters users by search input', async () => {
    render(<UsersView user={{ role: 'manager' }} />);
    await waitFor(() => expect(screen.getByText('Admin User')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Tìm kiếm/i), {
      target: { value: 'Driver' },
    });

    await waitFor(() => {
      expect(screen.getByText('Driver User')).toBeInTheDocument();
      expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
    });
  });
});
