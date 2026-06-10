import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserList from '../../src/features/admin/UserList';
import { message, Modal } from 'antd';

const mockUsers = [
  { id: 1, email: 'admin@test.com', full_name: 'Admin User', phone: '0123456789', role: 'admin', is_active: true },
  { id: 2, email: 'manager@test.com', full_name: 'Manager User', phone: '0987654321', role: 'manager', is_active: true },
  { id: 3, email: 'driver@test.com', full_name: 'Driver User', phone: '0999999999', role: 'driver', is_active: false },
];

describe('UserList L1 Frontend Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    Storage.prototype.getItem = vi.fn(() => 'fake-token');
    
    vi.spyOn(message, 'success').mockImplementation(() => {});
    vi.spyOn(message, 'error').mockImplementation(() => {});
    vi.spyOn(Modal, 'confirm').mockImplementation(() => {});
  });

  it('[L1-FE-01] Should show loading state initially', async () => {
    global.fetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    const { container } = render(<UserList />);
    
    expect(container.querySelector('.ant-spin-spinning')).toBeInTheDocument();
  });

  it('[L1-FE-02] Should render table rows on API Success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: mockUsers }),
    });

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Manager User')).toBeInTheDocument();
      expect(screen.getByText('Driver User')).toBeInTheDocument();
    });

    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText('MANAGER')).toBeInTheDocument();
    expect(screen.getByText('DRIVER')).toBeInTheDocument();
  });

  it('[L1-FE-03] Should call message.error on API Failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Không thể tải danh sách.' }),
    });

    render(<UserList />);

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith(expect.stringContaining('Không thể tải danh sách.'));
    });
  });

  it('[L1-FC-01] Should filter table when search input changes', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: mockUsers }),
    });

    render(<UserList />);
    await waitFor(() => expect(screen.getByText('Admin User')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Tìm kiếm theo tên, email, SĐT, vai trò...');
    
    fireEvent.change(searchInput, { target: { value: 'Driver' } });

    await waitFor(() => {
      expect(screen.getByText('Driver User')).toBeInTheDocument();
      expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
      expect(screen.queryByText('Manager User')).not.toBeInTheDocument();
    });
  });

  it('[L1-FC-02] Should open UserModal when "Thêm người dùng" is clicked', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: [] }),
    });

    render(<UserList />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const addButton = screen.getByRole('button', { name: /thêm người dùng/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Thêm người dùng mới')).toBeInTheDocument();
    });
  });

  it('[L1-FC-03] Should disable action buttons for manager role', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: mockUsers }),
    });

    render(<UserList />);
    await waitFor(() => expect(screen.getByText('Manager User')).toBeInTheDocument());

    const editButtons = screen.getAllByRole('button', { name: /sửa/i });
    const lockButtons = screen.getAllByRole('button', { name: /(khoá|mở khoá)/i });
    
    expect(editButtons[1]).toBeDisabled();
    expect(lockButtons[1]).toBeDisabled();

    expect(editButtons[0]).not.toBeDisabled();
    expect(lockButtons[0]).not.toBeDisabled();
  });

  it('[L1-FC-04] Should call Toggle Status API when confirmed', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: [mockUsers[0]] }),
    });

    render(<UserList />);
    await waitFor(() => expect(screen.getByText('Admin User')).toBeInTheDocument());

    Modal.confirm.mockImplementationOnce(({ onOk }) => onOk());

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Đã khoá tài khoản.' }),
    });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: [] }),
    });

    const lockButton = screen.getByRole('button', { name: /khoá/i });
    fireEvent.click(lockButton);

    expect(Modal.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/users/1/status'),
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(message.success).toHaveBeenCalledWith('Đã khoá tài khoản.');
    });
  });

  it('[L1-FC-05] Should call message.error when Toggle Status API fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: [mockUsers[0]] }),
    });

    render(<UserList />);
    await waitFor(() => expect(screen.getByText('Admin User')).toBeInTheDocument());

    Modal.confirm.mockImplementationOnce(({ onOk }) => onOk());

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Không thể khoá tài khoản lúc này.' }),
    });

    const lockButton = screen.getByRole('button', { name: /khoá/i });
    fireEvent.click(lockButton);

    expect(Modal.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith(expect.stringContaining('Không thể khoá tài khoản lúc này.'));
    });
  });
});
